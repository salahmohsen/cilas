import { execFileSync } from 'node:child_process'

const inspect = (name) =>
  JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
const environment = (container) =>
  Object.fromEntries(
    container.Config.Env.map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at), line.slice(at + 1)]
    }),
  )
const request = (name, method, path, key) => {
  const input = `${method} ${path} HTTP/1.0\r\nHost: localhost\r\nX-TYPESENSE-API-KEY: ${key}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`
  const response = execFileSync(
    'docker',
    ['exec', '-i', name, 'bash', '-c', 'exec 3<>/dev/tcp/127.0.0.1/8108; cat >&3; cat <&3'],
    { input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 },
  )
  return {
    status: Number(response.match(/^HTTP\/\S+ (\d+)/)?.[1]),
    body: JSON.parse(response.slice(response.indexOf('\r\n\r\n') + 4)),
  }
}
try {
  const webName = execFileSync(
    'docker',
    ['ps', '--filter', 'name=cilas-web-qfeky3.1.', '--format', '{{.ID}}'],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')
  if (webName.length !== 1 || !webName[0]) throw new Error()
  const web = inspect(webName[0])
  const env = environment(web)
  const publicName = 'cilas-typesense-hvbtzv-typesense-1'
  const privateName = 'cilas-typesense-hvbtzv-typesense-private-1'
  const privateContainer = inspect(privateName)
  const publicEnv = environment(inspect(publicName))
  const privateEnv = environment(privateContainer)
  const root = (path) => request(privateName, 'GET', path, privateEnv.TYPESENSE_API_KEY)
  const publicKeys = request(publicName, 'GET', '/keys', publicEnv.TYPESENSE_API_KEY)
  if (publicKeys.status !== 200) throw new Error()
  const browser = publicKeys.body.keys.find(
    (key) => key.description === 'CILAS public browser search (restricted)',
  )
  const checks = {
    privateEngineHealthy: privateContainer.State.Health?.Status === 'healthy',
    privateEngineVersion: root('/debug').body.version === '30.2',
    privateNetworkOnly:
      JSON.stringify(Object.keys(privateContainer.NetworkSettings.Networks)) ===
      JSON.stringify(['cilas-search']),
    noPrivatePublishedPorts: !Object.keys(privateContainer.HostConfig.PortBindings ?? {}).length,
    webOnPrivateNetwork: Boolean(web.NetworkSettings.Networks['cilas-search']),
    privatePersistentVolume: privateContainer.Mounts.some(
      (mount) => mount.Type === 'volume' && mount.Destination === '/data',
    ),
    privateLoggingDisabled:
      privateEnv.TYPESENSE_ENABLE_ACCESS_LOGGING === 'false' &&
      privateEnv.TYPESENSE_ENABLE_SEARCH_LOGGING === 'false' &&
      privateEnv.TYPESENSE_LOG_SLOW_REQUESTS_TIME_MS === '-1',
    privateLimits:
      privateContainer.HostConfig.Memory === 1073741824 &&
      privateContainer.HostConfig.NanoCpus === 1000000000,
    browserScoped: Boolean(
      browser &&
      env.NEXT_PUBLIC_TYPESENSE_API_KEY?.startsWith(browser.value_prefix) &&
      JSON.stringify(browser.actions) === JSON.stringify(['documents:search']) &&
      JSON.stringify(browser.collections) ===
        JSON.stringify(['^(courses|articles|people)(_[0-9a-f]{8})?$']),
    ),
    retiredWildcardRevoked: !publicKeys.body.keys.some((key) => key.collections.includes('*')),
    privateBootstrapAbsentFromWeb: !env.TYPESENSE_PRIVATE_BOOTSTRAP_KEY,
    privateFeatureOff: env.PRIVATE_SPACES_SEARCH === 'false',
    publicSearchWorks:
      request(
        publicName,
        'GET',
        '/collections/courses/documents/search?q=*&query_by=title_en&per_page=0',
        env.NEXT_PUBLIC_TYPESENSE_API_KEY,
      ).status === 200,
    publicKeyCannotManage:
      request(publicName, 'GET', '/keys', env.NEXT_PUBLIC_TYPESENSE_API_KEY).status === 401,
    publicIndexerCannotManage:
      request(publicName, 'GET', '/keys', env.TYPESENSE_API_KEY).status === 401,
    privateReadValid:
      request(
        privateName,
        'GET',
        '/collections/spaces_search_00000000000000000000000000000000/documents/search?q=*&query_by=body',
        env.TYPESENSE_PRIVATE_SEARCH_KEY,
      ).status === 404,
    privateWriteValid:
      request(privateName, 'GET', '/collections', env.TYPESENSE_PRIVATE_WRITE_KEY).status === 200,
  }
  const privatePaths = [
    '/keys',
    '/collections/spaces_search/documents/search?q=*&query_by=body',
    '/collections/spaces_search_00000000000000000000000000000000/documents/search?q=*&query_by=body',
    '/collections/spaces_search_00000000000000000000000000000000/documents/export',
    '/collections/courses/documents/search?q=*&query_by=title_en&include_fields=$spaces_search_00000000000000000000000000000000(*)',
  ]
  checks.browserDeniedPrivateOperations = privatePaths.every((path) =>
    [401, 403].includes(
      request(privateName, 'GET', path, env.NEXT_PUBLIC_TYPESENSE_API_KEY).status,
    ),
  )
  const publicCollections = request(
    publicName,
    'GET',
    '/collections',
    publicEnv.TYPESENSE_API_KEY,
  ).body
  checks.publicSchemasIsolated = publicCollections.every(
    (collection) =>
      !collection.name.startsWith('spaces_search') &&
      collection.fields.every((field) => !field.reference?.startsWith('spaces_search')),
  )
  const probe = `const fs=require('node:fs');const p='/app/.next/static/chunks';const files=fs.readdirSync(p).filter(f=>f.endsWith('.js'));let replacement=false,retired=false;for(const f of files){const s=fs.readFileSync(p+'/'+f,'utf8');replacement ||= s.includes(process.env.NEXT_PUBLIC_TYPESENSE_API_KEY);retired ||= s.includes('TQHz');}console.log(JSON.stringify({replacement,retired}));`
  const bundle = JSON.parse(
    execFileSync('docker', ['exec', webName[0], 'node', '-e', probe], { encoding: 'utf8' }),
  )
  checks.deployedBundleUsesReplacement = bundle.replacement && !bundle.retired
  console.log(JSON.stringify({ checks, privateCollections: root('/collections').body.length }))
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1
} catch {
  console.error('Private search release audit failed. No credentials or response bodies logged.')
  process.exitCode = 1
}

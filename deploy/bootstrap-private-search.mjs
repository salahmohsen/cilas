import { execFileSync } from 'node:child_process'
const name = 'cilas-typesense-hvbtzv-typesense-private-1'
try {
  const container = JSON.parse(execFileSync('docker', ['inspect', name], { encoding: 'utf8' }))[0]
  const env = Object.fromEntries(
    container.Config.Env.map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at), line.slice(at + 1)]
    }),
  )
  const request = (method, path, body, key = env.TYPESENSE_API_KEY) => {
    const json = body ? JSON.stringify(body) : ''
    const input = `${method} ${path} HTTP/1.0\r\nHost: localhost\r\nX-TYPESENSE-API-KEY: ${key}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(json)}\r\nConnection: close\r\n\r\n${json}`
    const response = execFileSync(
      'docker',
      ['exec', '-i', name, 'bash', '-c', 'exec 3<>/dev/tcp/127.0.0.1/8108; cat >&3; cat <&3'],
      { input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 },
    )
    const status = Number(response.match(/^HTTP\/\S+ (\d+)/)?.[1])
    const value = JSON.parse(response.slice(response.indexOf('\r\n\r\n') + 4))
    return { status, value }
  }
  const health = request('GET', '/health')
  if (health.status !== 200 || !health.value.ok) throw new Error()
  const keys = request('GET', '/keys')
  if (keys.status !== 200) throw new Error()
  const definitions = [
    {
      description: 'CILAS private Spaces search (server read)',
      actions: ['documents:search'],
      collections: ['^spaces_search_[a-f0-9]{32}$'],
      value: env.CILAS_PRIVATE_READ_KEY,
    },
    {
      description: 'CILAS private Spaces search (server write)',
      actions: ['collections:*', 'documents:import', 'documents:delete', 'aliases:*'],
      collections: ['^spaces_search(_[a-f0-9]{32})?$'],
      value: env.CILAS_PRIVATE_WRITE_KEY,
    },
  ]
  for (const definition of definitions) {
    if (!/^[a-f0-9]{64}$/.test(definition.value ?? '')) throw new Error()
    const existing = keys.value.keys.find((key) => key.description === definition.description)
    if (existing) {
      if (
        !definition.value.startsWith(existing.value_prefix) ||
        JSON.stringify(existing.actions) !== JSON.stringify(definition.actions) ||
        JSON.stringify(existing.collections) !== JSON.stringify(definition.collections)
      )
        throw new Error()
    } else {
      const created = request('POST', '/keys', definition)
      if (![200, 201].includes(created.status) || created.value.value !== definition.value)
        throw new Error()
    }
  }
  const read = request('GET', '/keys', undefined, env.CILAS_PRIVATE_READ_KEY)
  if (![401, 403].includes(read.status)) throw new Error()
  console.log(
    JSON.stringify({
      healthy: true,
      restrictedKeysProvisioned: true,
      readKeyCannotAdminister: true,
      networks: Object.keys(container.NetworkSettings.Networks),
      persistentVolume: container.Mounts.some(
        (mount) => mount.Type === 'volume' && mount.Destination === '/data',
      ),
      memoryLimit: container.HostConfig.Memory,
      cpuLimit: container.HostConfig.NanoCpus,
    }),
  )
} catch {
  console.error('Private engine bootstrap failed. No credentials or response bodies logged.')
  process.exitCode = 1
}

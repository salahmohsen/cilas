import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const source = 'cilas-typesense-hvbtzv-typesense-1'
const canary = 'cilas-public-typesense-302-canary'
const volume = 'cilas-typesense-public-302-data'
const snapshot = '/data/public-upgrade-302-snapshot'
const marker = '/data/public-upgrade-302-baseline.json'
const image = 'typesense/typesense:30.2'
const phase = process.argv[2]
let stage = 'startup'
const docker = (args) =>
  execFileSync('docker', args, { encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 })
const inspect = (name) => JSON.parse(docker(['inspect', name]))[0]
const environment = (container) =>
  Object.fromEntries(
    container.Config.Env.map((line) => {
      const at = line.indexOf('=')
      return [line.slice(0, at), line.slice(at + 1)]
    }),
  )
const hash = (value) =>
  createHash('sha256')
    .update(JSON.stringify(value) ?? 'undefined')
    .digest('hex')
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value
const request = (container, path, key, body, method = body === undefined ? 'GET' : 'POST') => {
  const content = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const input = `${method} ${path} HTTP/1.0\r\nHost: localhost\r\nX-TYPESENSE-API-KEY: ${key}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(content)}\r\nConnection: close\r\n\r\n${content}`
  const response = execFileSync(
    'docker',
    ['exec', '-i', container, 'bash', '-c', 'exec 3<>/dev/tcp/127.0.0.1/8108; cat >&3; cat <&3'],
    { input, encoding: 'utf8', timeout: 30000, maxBuffer: 32 * 1024 * 1024 },
  )
  const status = Number(response.match(/^HTTP\/\S+ (\d+)/)?.[1])
  const raw = response.slice(response.indexOf('\r\n\r\n') + 4)
  return { status, raw }
}
const json = (container, path, key, body, method) => {
  const result = request(container, path, key, body, method)
  if (result.status < 200 || result.status >= 300) throw new Error('Engine operation failed')
  return JSON.parse(result.raw)
}
const requireCheck = (condition) => {
  if (!condition) throw new Error('Verification failed')
}
const baseline = (container, key, browser) => {
  const aliases = json(container, '/aliases', key).aliases.sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  const keys = json(container, '/keys', key).keys.sort((a, b) => a.id - b.id)
  requireCheck(!keys.some((key) => key.collections.includes('*')))
  const collections = json(container, '/collections', key)
  requireCheck(collections.every((c) => /^(courses|articles|people)(_[a-f0-9]{8})?$/.test(c.name)))
  const result = { aliases, keysHash: hash(canonical(keys)), collections: [], searchChecks: [] }
  for (const collection of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const exported = request(container, `/collections/${collection.name}/documents/export`, key)
    requireCheck(exported.status === 200)
    const docs = exported.raw.trim()
      ? exported.raw
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line))
          .sort((a, b) => a.id.localeCompare(b.id))
      : []
    result.collections.push({
      name: collection.name,
      count: docs.length,
      hash: hash(canonical(docs)),
      schemaHash: hash(
        canonical(
          collection.fields.map((field) => ({ ...field, truncate_len: field.truncate_len ?? 100 })),
        ),
      ),
    })
    const alias = aliases.find((a) => a.collection_name === collection.name)?.name
    requireCheck(Boolean(alias))
    const field = alias === 'people' ? 'name' : 'title'
    const terms = [
      '*',
      ...['en', 'ar'].flatMap((locale) => {
        const text = docs.find(
          (doc) =>
            typeof doc[`${field}_${locale}`] === 'string' && doc[`${field}_${locale}`].trim(),
        )?.[`${field}_${locale}`]
        const term = text?.match(/[\p{L}\p{N}]{3,}/u)?.[0]
        return term ? [term] : []
      }),
    ]
    for (const q of terms)
      for (const sort of [
        '_text_match:desc,updatedAt:desc',
        'sortTitle_en:asc',
        'sortTitle_ar:asc',
      ]) {
        const query = new URLSearchParams({
          q,
          query_by: `${field}_en,${field}_ar`,
          per_page: '20',
          sort_by: sort,
          use_cache: 'false',
          ...(alias === 'courses' ? { facet_by: 'courseType' } : {}),
        })
        const response = json(container, `/collections/${alias}/documents/search?${query}`, browser)
        result.searchChecks.push(
          hash(
            canonical({
              alias,
              q,
              sort,
              found: response.found,
              ids: response.hits.map((h) => h.document.id),
              facets: response.facet_counts,
            }),
          ),
        )
      }
    if (alias === 'courses') {
      for (const kind of new Set(docs.map((doc) => doc.courseType).filter(Boolean))) {
        requireCheck(/^[A-Z]+$/.test(kind))
        const query = new URLSearchParams({
          q: '*',
          query_by: 'title_en,title_ar',
          per_page: '20',
          sort_by: 'updatedAt:desc',
          filter_by: `courseType:=${kind}`,
          use_cache: 'false',
        })
        const filtered = json(container, `/collections/${alias}/documents/search?${query}`, browser)
        result.searchChecks.push(
          hash(
            canonical({
              alias,
              kind,
              found: filtered.found,
              ids: filtered.hits.map((hit) => hit.document.id),
            }),
          ),
        )
      }
    }
    const multi = json(container, '/multi_search', browser, {
      searches: [
        {
          collection: alias,
          q: '*',
          query_by: `${field}_en,${field}_ar`,
          per_page: 5,
          use_cache: false,
        },
      ],
    })
    requireCheck(!multi.results[0].error)
    result.searchChecks.push(
      hash(
        canonical({
          alias,
          found: multi.results[0].found,
          ids: multi.results[0].hits.map((h) => h.document.id),
        }),
      ),
    )
  }
  requireCheck(request(container, '/keys', browser).status === 401)
  requireCheck(
    request(
      container,
      '/collections/spaces_search_00000000000000000000000000000000/documents/search?q=*&query_by=body',
      browser,
    ).status === 401,
  )
  return result
}
try {
  const original = inspect(source)
  const env = environment(original)
  const web = docker(['ps', '--filter', 'name=cilas-web-qfeky3.1.', '--format', '{{.ID}}'])
    .trim()
    .split('\n')
  requireCheck(web.length === 1 && web[0])
  const browser = environment(inspect(web[0])).NEXT_PUBLIC_TYPESENSE_API_KEY
  requireCheck(Boolean(browser))
  const key = env.TYPESENSE_API_KEY
  const indexer = environment(inspect(web[0])).TYPESENSE_API_KEY
  if (phase === 'prepare') {
    requireCheck(json(source, '/debug', key).version === '29.0')
    docker(['pull', image])
    stage = 'source baseline'
    const before = baseline(source, key, browser)
    const ruleCounts = before.collections.map((collection) => ({
      collection: collection.name,
      synonyms: json(source, `/collections/${collection.name}/synonyms`, key).synonyms.length,
      overrides: json(source, `/collections/${collection.name}/overrides`, key).overrides.length,
    }))
    requireCheck(ruleCounts.every((count) => count.synonyms === 0 && count.overrides === 0))
    requireCheck(json(source, '/analytics/rules', key).rules.length === 0)
    requireCheck(
      json(
        source,
        `/operations/snapshot?snapshot_path=${encodeURIComponent(snapshot)}`,
        key,
        undefined,
        'POST',
      ).success,
    )
    const sourceVolume = original.Mounts.find(
      (mount) => mount.Destination === '/data' && mount.Type === 'volume',
    )?.Name
    requireCheck(Boolean(sourceVolume))
    requireCheck(
      !docker(['volume', 'ls', '--format', '{{.Name}}']).trim().split('\n').includes(volume),
    )
    docker(['volume', 'create', volume])
    docker([
      'run',
      '--rm',
      '--network',
      'none',
      '--entrypoint',
      'bash',
      '--mount',
      `type=volume,source=${sourceVolume},target=/source,readonly`,
      '--mount',
      `type=volume,source=${volume},target=/target`,
      original.Config.Image,
      '-c',
      'cp -a /source/public-upgrade-302-snapshot/. /target/',
    ])
    execFileSync(
      'docker',
      [
        'run',
        '--detach',
        '--name',
        canary,
        '--network',
        'none',
        '--mount',
        `type=volume,source=${volume},target=/data`,
        '--env',
        'TYPESENSE_API_KEY',
        '--env',
        'TYPESENSE_DATA_DIR=/data',
        '--env',
        'TYPESENSE_ENABLE_ACCESS_LOGGING=false',
        '--env',
        'TYPESENSE_ENABLE_SEARCH_LOGGING=false',
        '--env',
        'TYPESENSE_LOG_SLOW_REQUESTS_TIME_MS=-1',
        image,
      ],
      { env: { ...process.env, TYPESENSE_API_KEY: key }, stdio: 'pipe', timeout: 30000 },
    )
    // Verification is a separate invocation so startup never blocks the operator's connection.
    console.log(
      JSON.stringify({
        phase,
        sourceVolume,
        candidateVolume: volume,
        snapshotCreated: true,
        candidateStarted: true,
        sourceCollections: before.collections.map((c) => ({ name: c.name, count: c.count })),
      }),
    )
  } else if (phase === 'sync') {
    const collections = json(source, '/collections', key)
    requireCheck(collections.every((c) => /^(courses|articles|people)_[a-f0-9]{8}$/.test(c.name)))
    let documents = 0
    for (const collection of collections) {
      const exported = request(source, `/collections/${collection.name}/documents/export`, key)
      requireCheck(exported.status === 200)
      const imported = request(
        canary,
        `/collections/${collection.name}/documents/import?action=upsert`,
        indexer,
        exported.raw,
        'POST',
      )
      requireCheck(imported.status === 200)
      const rows = imported.raw
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
      requireCheck(rows.length === collection.num_documents && rows.every((row) => row.success))
      documents += rows.length
    }
    console.log(
      JSON.stringify({ phase, publicDocumentsReplayed: documents, sourceUnchanged: true }),
    )
  } else if (phase === 'verify') {
    requireCheck(json(canary, '/debug', key).version === '30.2')
    stage = 'source baseline'
    const before = baseline(source, key, browser)
    stage = 'candidate baseline'
    const candidate = baseline(canary, key, browser)
    stage = 'baseline comparison'
    if (hash(canonical(before)) !== hash(canonical(candidate)))
      console.log(
        JSON.stringify({
          aliasesEqual: hash(before.aliases) === hash(candidate.aliases),
          keysEqual: before.keysHash === candidate.keysHash,
          collections: before.collections.map((c, i) => ({
            name: c.name,
            countEqual: c.count === candidate.collections[i]?.count,
            documentsEqual: c.hash === candidate.collections[i]?.hash,
            schemaEqual: c.schemaHash === candidate.collections[i]?.schemaHash,
          })),
          searchChecksEqual: before.searchChecks.map((h, i) => h === candidate.searchChecks[i]),
        }),
      )
    requireCheck(hash(canonical(before)) === hash(canonical(candidate)))
    stage = 'indexer operations'
    const testCollection = 'courses_f00dbabe'
    const testAlias = 'courses_cafebabe'
    json(canary, '/collections', indexer, {
      name: testCollection,
      fields: [{ name: 'title_en', type: 'string' }],
    })
    try {
      const imported = request(
        canary,
        `/collections/${testCollection}/documents/import?action=upsert`,
        indexer,
        JSON.stringify({ id: 'upgrade-check', title_en: 'Synthetic upgrade verification' }) + '\n',
      )
      requireCheck(imported.status === 200 && JSON.parse(imported.raw).success)
      json(canary, `/aliases/${testAlias}`, indexer, { collection_name: testCollection }, 'PUT')
      requireCheck(
        json(
          canary,
          `/collections/${testAlias}/documents/search?q=Synthetic&query_by=title_en`,
          browser,
        ).found === 1,
      )
      requireCheck(
        request(canary, `/collections/${testCollection}/documents/export`, indexer).status === 200,
      )
      requireCheck(
        request(
          canary,
          `/collections/${testCollection}/documents?filter_by=id:=upgrade-check`,
          indexer,
          undefined,
          'DELETE',
        ).status === 200,
      )
    } finally {
      requireCheck(
        request(canary, `/aliases/${testAlias}`, indexer, undefined, 'DELETE').status === 200,
      )
      requireCheck(
        request(canary, `/collections/${testCollection}`, indexer, undefined, 'DELETE').status ===
          200,
      )
    }
    requireCheck(hash(canonical(baseline(canary, key, browser))) === hash(canonical(before)))
    execFileSync('docker', ['exec', '-i', canary, 'bash', '-c', `umask 077; cat > ${marker}`], {
      input: JSON.stringify(before),
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    console.log(
      JSON.stringify({
        phase,
        version: '30.2',
        collections: before.collections.map((c) => ({ name: c.name, count: c.count })),
        searchChecks: before.searchChecks.length,
        keysAndAliasesPreserved: true,
        privateAccessDenied: true,
        parity: true,
      }),
    )
  } else if (phase === 'release') {
    const expected = JSON.parse(docker(['exec', canary, 'cat', marker]))
    requireCheck(hash(canonical(baseline(source, key, browser))) === hash(canonical(expected)))
    docker(['stop', canary])
    console.log(
      JSON.stringify({
        phase,
        candidateStopped: true,
        sourceUnchanged: true,
        readyForComposeCutover: true,
      }),
    )
  } else if (phase === 'postcheck') {
    requireCheck(json(source, '/debug', key).version === '30.2')
    requireCheck(
      original.Mounts.some((mount) => mount.Name === volume && mount.Destination === '/data'),
    )
    const expected = JSON.parse(docker(['exec', source, 'cat', marker]))
    const actual = baseline(source, key, browser)
    requireCheck(hash(canonical(actual)) === hash(canonical(expected)))
    console.log(
      JSON.stringify({
        phase,
        version: '30.2',
        collections: actual.collections.map((c) => ({ name: c.name, count: c.count })),
        searchChecks: actual.searchChecks.length,
        keysAndAliasesPreserved: true,
        privateAccessDenied: true,
        parity: true,
      }),
    )
  } else throw new Error('Unknown phase')
} catch {
  console.error(
    'Public Typesense upgrade check failed. No credentials, queries or document bodies logged.',
  )
  console.error(JSON.stringify({ phase, stage }))
  process.exitCode = 1
}

import { getPayload } from 'payload'
import config from '../src/payload.config'
import { privateClient } from '../src/lib/private-search/config'
import { processOutbox, rebuild, pruneGenerations } from '../src/lib/private-search/worker'

const command = process.argv[2]
if (command !== 'work' && command !== 'rebuild' && command !== 'prune')
  throw new Error('Expected work, rebuild or prune')
const payload = await getPayload({ config })
try {
  const client = privateClient('write')
  const result =
    command === 'rebuild'
      ? await rebuild(payload, client)
      : command === 'prune'
        ? await pruneGenerations(payload, client)
        : await processOutbox(payload, client)
  console.info(JSON.stringify(result ?? { busy: true }))
  if (result && 'recoveryRequired' in result && result.recoveryRequired) process.exitCode = 1
} catch {
  console.error('Private search maintenance failed. No document or engine error logged.')
  process.exitCode = 1
} finally {
  await payload.destroy()
}

process.exit(process.exitCode ?? 0)

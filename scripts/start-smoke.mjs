import { cp } from 'node:fs/promises'

await Promise.all([
  cp('public', '.next/standalone/public', { recursive: true }),
  cp('.next/static', '.next/standalone/.next/static', { recursive: true }),
])

process.env.HOSTNAME = '127.0.0.1'
process.env.PORT = '3000'
await import('../.next/standalone/server.js')

import { build } from 'esbuild'
import nft from 'next/dist/compiled/@vercel/nft/index.js'
import { copyFile, mkdir, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const output = path.join(root, '.maintenance')
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
await build({
  entryPoints: ['scripts/private-search.ts'],
  outfile: path.join(output, 'private-search.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  logLevel: 'warning',
})
// Several installed Payload plugins ship extensionless ESM imports, resolved by tsx.
await writeFile(
  path.join(output, 'run.mjs'),
  "import { register } from 'tsx/esm/api'; register(); await import('./private-search.mjs');\n",
)
const { fileList, reasons } = await nft.nodeFileTrace(
  ['.maintenance/run.mjs', '.maintenance/private-search.mjs'],
  {
    base: root,
    conditions: ['node', 'production'],
  },
)
let copied = 0
for (const file of fileList) {
  // Preserve pnpm's relative links. Never copy .env or unrelated source files.
  if (!file.startsWith('node_modules/')) continue
  const target = path.join(output, file)
  await mkdir(path.dirname(target), { recursive: true })
  if (reasons.get(file)?.type.includes('resolve')) {
    try {
      const link = await readlink(path.join(root, file))
      if (path.isAbsolute(link)) throw new Error('Absolute dependency link cannot be packaged')
      await symlink(link, target)
      continue
    } catch (error) {
      if (error.code !== 'EINVAL') throw error
    }
  }
  await copyFile(path.join(root, file), target)
  copied++
}
await writeFile(
  path.join(output, 'package.json'),
  JSON.stringify({ type: 'module', private: true }),
)
console.info(`Private search maintenance packaged with ${copied} dependency files.`)

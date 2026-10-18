// Bundles the visual editor's site SDK into one file the newsletter preview
// can load: the preview is plain email HTML, with no React or bundler.
// Run after upgrading @payload-inline-visual-editor/core:
//   node scripts/visual-editor-sdk.mjs
import { build } from 'esbuild'

await build({
  stdin: {
    contents: "export { initVisualEditing } from '@payload-inline-visual-editor/core'",
    resolveDir: process.cwd(),
  },
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outfile: 'public/assets/visual-editor/sdk.js',
  legalComments: 'inline',
})
console.log('visual editor SDK written')

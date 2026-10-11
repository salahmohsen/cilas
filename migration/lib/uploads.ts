const UPLOADS = /(?:^|\/)(uploads\/\d+\/\d+\/\d+\/\d+\/\d+\/.+)$/

const CP1252 = new TextDecoder('windows-1252')
const CP1252_BYTE = new Map<string, number>()
for (let b = 0x80; b <= 0x9f; b++) CP1252_BYTE.set(CP1252.decode(Uint8Array.of(b)), b)

/**
 * Arabic names in links often arrive as UTF-8 bytes read as Latin-1 or
 * Windows-1252 ("Ù…Ù‚Ø§Ù„"). Undo that; null when the text is not such bytes.
 */
const demojibake = (text: string): string | null => {
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0)!
    if (code < 0x100) bytes.push(code)
    else if (CP1252_BYTE.has(ch)) bytes.push(CP1252_BYTE.get(ch)!)
    else return null
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes))
  } catch {
    return null
  }
}

/**
 * The archive file an upload link points to. Weebly served resized images
 * from `published/X.ext`; the ZIP keeps the original as `X_orig.ext`. When
 * only the published copy was saved (the mirror lacks some originals), use it.
 */
export const resolveUpload = (
  href: string,
  files: Set<string>,
): { path: string; missing: boolean } | null => {
  const clean = href.split(/[?#]/)[0].replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+\//, '')
  const match = UPLOADS.exec(clean.replace(/^https?:\/\/(www\.)?(ci-las\.org|cilas\.lkssystems\.com)\//, ''))
  if (!match) return null

  let path = decodeURIComponent(match[1])
  const published = /^(.*)\/published\/([^/]+)\.(\w+)$/.exec(path)
  if (published) {
    const original = `${published[1]}/${published[2]}_orig.${published[3]}`
    if (files.has(original) || !files.has(path)) path = original
  }

  if (!files.has(path) && /[\u0080-\u00ff]/.test(path)) {
    const fixed = demojibake(path)
    if (fixed && files.has(fixed)) path = fixed
  }

  return { path, missing: !files.has(path) }
}

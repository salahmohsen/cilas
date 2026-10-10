const UPLOADS = /(?:^|\/)(uploads\/\d+\/\d+\/\d+\/\d+\/\d+\/.+)$/

/**
 * The archive file an upload link points to. Weebly served resized images
 * from `published/X.ext`; the ZIP keeps the original as `X_orig.ext`.
 */
export const resolveUpload = (
  href: string,
  files: Set<string>,
): { path: string; missing: boolean } | null => {
  const clean = href.split(/[?#]/)[0].replace(/^https?:\/\/web\.archive\.org\/web\/[^/]+\//, '')
  const match = UPLOADS.exec(clean.replace(/^https?:\/\/(www\.)?ci-las\.org\//, ''))
  if (!match) return null

  let path = decodeURIComponent(match[1])
  const published = /^(.*)\/published\/([^/]+)\.(\w+)$/.exec(path)
  if (published) path = `${published[1]}/${published[2]}_orig.${published[3]}`

  return { path, missing: !files.has(path) }
}

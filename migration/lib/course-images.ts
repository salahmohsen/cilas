import { JSDOM } from 'jsdom'

import { uploadsPath } from './media-plan'

/**
 * On a cycle page each course sits in its own block: Weebly columns (an image
 * beside the title, fellow and text), or a run of paragraphs between two
 * rules. A course's image is the first uploaded image in the smallest block
 * around its title that holds no other course's title, or else in the run
 * between rules that holds its title and no other. Pure: the runner reads the
 * page and uploads the files.
 */

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670\u200b]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[^\p{L}\p{N}]+/gu, '')

/** The start of a title, enough to find it in the page's text. */
const keyOf = (title: string): string => fold(title).slice(0, 24)

/** Images every page shows (the logo), never a course's. */
const SITE_IMAGES = /\/(?:1395412828\.png)$/

export const courseImagesOnPage = (
  html: string,
  courses: Array<{ legacy_url: string; titles: string[] }>,
): Map<string, string> => {
  const { document } = new JSDOM(html).window
  const root = document.querySelector('#wsite-content') ?? document.body
  root.querySelectorAll('script, style, noscript').forEach((el) => el.remove())
  const elements = Array.from(root.querySelectorAll('*'))
  const keys = courses.map((c) => c.titles.map(keyOf).filter((k) => k.length >= 6))

  /** The deepest element whose text has one of the keys. */
  const titleOf = (own: string[]): Element | null => {
    const has = (el: Element) => own.some((k) => fold(el.textContent ?? '').includes(k))
    const hits = elements.filter(has)
    return hits.find((el) => !Array.from(el.children).some(has)) ?? null
  }

  const imageOf = (img: Element): string | null => {
    const p = uploadsPath(img.getAttribute('src') ?? '')
    return p && !SITE_IMAGES.test(`/${p}`) ? p : null
  }
  const titles = keys.map(titleOf)

  // The runs between rules, in page order: their images and course titles.
  const runs: Array<{ images: string[]; courses: number[] }> = [{ images: [], courses: [] }]
  for (const el of elements) {
    if (el.tagName === 'HR') runs.push({ images: [], courses: [] })
    else if (el.tagName === 'IMG') {
      const image = imageOf(el)
      if (image) runs.at(-1)!.images.push(image)
    }
    titles.forEach((t, i) => {
      if (t === el) runs.at(-1)!.courses.push(i)
    })
  }

  const found = new Map<string, string>()
  const used = new Map<string, number>()
  const take = (url: string, image: string) => {
    found.set(url, image)
    used.set(image, (used.get(image) ?? 0) + 1)
  }
  courses.forEach((course, i) => {
    const others = keys.filter((_, j) => j !== i).flat()
    let block = titles[i]
    while (block && block !== root.parentElement) {
      const text = fold(block.textContent ?? '')
      if (others.some((k) => text.includes(k))) break
      const image = Array.from(block.querySelectorAll('img')).map(imageOf).find(Boolean)
      if (image) return take(course.legacy_url, image)
      block = block.parentElement
    }
    const run = runs.find((r) => r.courses.length === 1 && r.courses[0] === i && r.images.length)
    if (run) take(course.legacy_url, run.images[0])
  })
  // An image two courses claim belongs to neither for sure.
  for (const [url, image] of found) if ((used.get(image) ?? 0) > 1) found.delete(url)
  return found
}

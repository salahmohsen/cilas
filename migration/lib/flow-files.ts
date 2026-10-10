import path from 'node:path'

import { slugify } from '../../src/lib/slugify'

export type FlowMethod = 'text' | 'mixed' | 'vision' | 'docx'

/** The flow's id: the slug of its upload file name, without the extension. */
export const flowId = (upload: string): string => {
  const base = path.posix.basename(upload.split(/[?#]/)[0])
  let name = base
  try {
    name = decodeURIComponent(base)
  } catch {
    // keep the raw name
  }
  return slugify(name.replace(/\.[^.]+$/, ''))
}

/** How a flow is read: Word as docx, Arabic PDFs by vision, other PDFs as text. */
export const methodFor = (file: string, arabicShare: number): FlowMethod => {
  if (/\.docx?$/i.test(file)) return 'docx'
  if (arabicShare > 0.2) return 'vision'
  // English flows quoting Arabic: the text layer reverses the Arabic, so the
  // page images are needed for those words.
  return arabicShare >= 0.01 ? 'mixed' : 'text'
}

/** Parses the `pdfinfo -url` table; mailto links are not sources. */
export const parseUrls = (output: string): { page: number; url: string }[] =>
  output.split('\n').flatMap((line) => {
    const m = /^\s*(\d+)\s+\S+\s+(\S+)\s*$/.exec(line)
    return m && !/^mailto:/i.test(m[2]) ? [{ page: Number(m[1]), url: m[2] }] : []
  })

/** Share of letters that are Arabic, 0 when there are none. */
export const arabicShareOf = (text: string): number => {
  const letters = text.match(/\p{L}/gu) ?? []
  if (letters.length === 0) return 0
  return letters.filter((c) => /\p{Script=Arabic}/u.test(c)).length / letters.length
}

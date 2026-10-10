import { describe, expect, it } from 'vitest'

import { flowId, methodFor, parseUrls } from '../../migration/lib/flow-files'

describe('flowId', () => {
  it('slugifies the file name without its extension', () => {
    expect(flowId('uploads/1/9/1/0/19102967/story_as_participative_enquiry__1_.pdf')).toBe(
      'story-as-participative-enquiry-1',
    )
  })

  it('gives an Arabic file name a non-empty slug', () => {
    const id = flowId(
      'uploads/1/9/1/0/19102967/%D8%AE%D8%B7%D8%A9_%D9%85%D8%AE%D8%AA%D8%A8%D8%B1_%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9_%D8%A7%D9%84%D8%B3%D8%A7%D8%A8%D8%B9.pdf',
    )
    expect(id).not.toBe('')
    expect(id).toMatch(/^[a-z0-9-]+$/)
  })
})

describe('methodFor', () => {
  it('reads Arabic PDFs by vision and the rest by text', () => {
    expect(methodFor('x.pdf', 0.5)).toBe('vision')
    expect(methodFor('x.pdf', 0.2)).toBe('mixed')
    expect(methodFor('x.pdf', 0.01)).toBe('mixed')
    expect(methodFor('x.pdf', 0.009)).toBe('text')
    expect(methodFor('x.pdf', 0)).toBe('text')
  })

  it('reads Word files as docx', () => {
    expect(methodFor('x.docx', 0)).toBe('docx')
    expect(methodFor('x.doc', 0)).toBe('docx')
  })
})

describe('parseUrls', () => {
  it('turns the pdfinfo -url table into page and url, skipping mailto', () => {
    const out = `Page  Type          URL
   2  Annotation    https://archive.org/details/noh390b2714105/page/n11/mode/2up
   2  Annotation    mailto:a@b.c
   3  Annotation    https://kohantextilejournal.com/woven-storytelling-coptic-tapestries/
`
    expect(parseUrls(out)).toEqual([
      { page: 2, url: 'https://archive.org/details/noh390b2714105/page/n11/mode/2up' },
      { page: 3, url: 'https://kohantextilejournal.com/woven-storytelling-coptic-tapestries/' },
    ])
  })
})

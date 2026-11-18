import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RichTextField } from '@/components/RichTextField'
import { programmeEditorial } from '@/migrations/lib/programme-editorial'

it('renders migrated programme lists and every quote with the existing rich-text renderer', () => {
  const result = programmeEditorial({
    highlights: [{ text: { en: 'Reading together' } }],
    testimonials: [
      { quote: { en: 'First quote' }, attribution: { en: 'CILASian' } },
      { quote: { en: 'Second quote' } },
    ],
  })
  const html = renderToStaticMarkup(<RichTextField data={result.en} />)
  const document = new DOMParser().parseFromString(html, 'text/html')
  expect(document.querySelector('li')?.textContent).toBe('Reading together')
  expect(document.querySelectorAll('blockquote')).toHaveLength(2)
  expect(document.querySelector('footer cite')?.textContent).toBe('CILASian')
  expect(document.body.textContent).toContain('Second quote')
})

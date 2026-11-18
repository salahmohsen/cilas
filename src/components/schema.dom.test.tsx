import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Schema } from '@/components/schema'

describe('JSON-LD output', () => {
  it('renders parseable data without letting content close the script tag', () => {
    const name = '</script><script>alert(1)</script>'
    const html = renderToStaticMarkup(<Schema data={{ '@type': 'Event', name }} />)
    const root = document.createElement('div')
    root.innerHTML = html
    expect(root.querySelectorAll('script')).toHaveLength(1)
    expect(JSON.parse(root.querySelector('script')!.textContent!)).toEqual({
      '@type': 'Event',
      name,
    })
  })

  it('puts several items in one @graph, so the script is always a single object', () => {
    const html = renderToStaticMarkup(
      <Schema
        data={[
          { '@context': 'https://schema.org', '@type': 'Organization', name: 'CILAS' },
          { '@context': 'https://schema.org', '@type': 'WebSite', name: 'CILAS' },
        ]}
      />,
    )
    const root = document.createElement('div')
    root.innerHTML = html
    expect(JSON.parse(root.querySelector('script')!.textContent!)).toEqual({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'CILAS' },
        { '@type': 'WebSite', name: 'CILAS' },
      ],
    })
  })
})

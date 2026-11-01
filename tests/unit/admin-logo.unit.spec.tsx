import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AdminIcon, AdminLogo } from '@/components/admin/brand/admin-logo'

describe('admin brand graphics', () => {
  it('draws the CILAS mark as inline SVG that follows the theme colour', () => {
    const html = renderToStaticMarkup(createElement(AdminLogo))
    expect(html).toContain('<svg')
    expect(html).toContain('fill="currentColor"')
    expect(html).toContain('aria-label="CILAS admin"')
    expect(html).not.toMatch(/<img/i)
  })

  it('has a small icon without the name', () => {
    const html = renderToStaticMarkup(createElement(AdminIcon))
    expect(html).toContain('<svg')
    expect(html).not.toContain('CILAS</span>')
  })

  it('names Payload nowhere', () => {
    expect(renderToStaticMarkup(createElement(AdminLogo))).not.toMatch(/payload/i)
  })
})

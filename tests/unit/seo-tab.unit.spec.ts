import type { CollectionConfig, Config, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import { seoTabFor, withSeoTab } from '@/lib/seo-tab'

const meta: Field = {
  name: 'meta',
  type: 'group',
  label: 'SEO',
  fields: [{ name: 'title', type: 'text' }],
}
const tabs: Field = {
  type: 'tabs',
  tabs: [{ label: 'Overview', fields: [{ name: 'subtitle', type: 'text' }] }],
}
const courses = (fields: Field[]): CollectionConfig => ({ slug: 'courses', fields })

describe('withSeoTab', () => {
  it('moves the meta group into a last tab named SEO, keeping the field name', () => {
    const out = withSeoTab(courses([{ name: 'title', type: 'text' }, tabs, meta]))
    expect(out.fields.map((f) => f.type)).toEqual(['text', 'tabs'])
    const inner = out.fields.find((f) => f.type === 'tabs')
    const seo = inner && 'tabs' in inner ? inner.tabs.at(-1) : undefined
    expect(seo?.label).toBe('SEO')
    expect(seo?.fields).toHaveLength(1)
    expect(seo?.fields[0]).toMatchObject({ name: 'meta', type: 'group', label: false })
    expect(inner && 'tabs' in inner ? inner.tabs[0]?.label : null).toBe('Overview')
  })

  it('fails loudly when the collection has no tabs or no meta group', () => {
    expect(() => withSeoTab(courses([meta]))).toThrow('courses')
    expect(() => withSeoTab(courses([tabs]))).toThrow('courses')
  })
})

describe('seoTabFor', () => {
  it('changes only the named collections', async () => {
    const config = {
      collections: [courses([tabs, meta]), { slug: 'articles', fields: [meta] }],
    } as unknown as Config
    const out = await seoTabFor(['courses'])(config)
    expect(out.collections?.[1]?.fields).toEqual([meta])
    expect(out.collections?.[0]?.fields.map((f) => f.type)).toEqual(['tabs'])
  })
})

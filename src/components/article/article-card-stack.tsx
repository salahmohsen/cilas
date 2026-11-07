'use client'

import { OrbitCardStack, type OrbitStackItem } from '@/components/ui/orbit-card-stack'
import { CollectionRows } from '@/components/article/collection-card'

/**
 * A Card stack block in an article's text: the orbit card stack on wide
 * screens, and on phones, where the fan has no room, the collection card's
 * ruled rows (docs/content-driven-card-layouts.md).
 */
export function ArticleCardStack({
  items,
  label,
  dir,
  locale,
}: {
  items: OrbitStackItem[]
  label: string
  dir: 'ltr' | 'rtl'
  locale: string
}) {
  return (
    <div className="not-prose my-8">
      <OrbitCardStack
        className="hidden overflow-x-clip p-0 lg:flex xl:overflow-visible"
        dir={dir}
        items={items}
        label={label}
        spread={Math.min(150, 380 / Math.max(1, items.length - 2))}
      />
      {/* Phones: the collection card's ruled rows, under the stack's name. */}
      {/* The wrapper hides it: the frame's own display rule would beat lg:hidden. */}
      <div className="lg:hidden">
        <div className="collection-card-frame">
          <nav aria-label={label} className="collection-card">
            <p className="collection-card-label">{label}</p>
            <CollectionRows
              items={items.map((item, i) => ({
                id: i,
                title: item.name,
                authors: item.role,
                href: item.href,
              }))}
              locale={locale}
            />
          </nav>
        </div>
      </div>
    </div>
  )
}

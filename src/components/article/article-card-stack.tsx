'use client'

import { Link } from '@/i18n/navigation'
import { OrbitCardStack, type OrbitStackItem } from '@/components/ui/orbit-card-stack'
import { focalPointStyle } from '@/lib/media-image'

/**
 * A Card stack block in an article's text: the orbit card stack on wide
 * screens, and on phones, where the fan has no room, a plain list.
 */
export function ArticleCardStack({
  items,
  label,
  dir,
}: {
  items: OrbitStackItem[]
  label: string
  dir: 'ltr' | 'rtl'
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
      <ul aria-label={label} className="grid gap-3 lg:hidden">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              className="flex items-center gap-3 rounded-lg border border-(--border) p-3 hover:bg-(--accent)"
              href={item.href}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={item.imageAlt ?? ''}
                  className="size-14 shrink-0 rounded-md object-cover"
                  src={item.image}
                  style={focalPointStyle(item.imageFocalPoint)}
                />
              ) : null}
              <span className="min-w-0">
                <span className="block text-xs text-(--text-secondary)" dir="auto">
                  {[item.role, item.stat].filter(Boolean).join(' · ')}
                </span>
                <span className="block font-medium" dir="auto">
                  {item.name}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

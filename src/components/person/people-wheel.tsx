'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'

import { personAvatarSeed } from '@/lib/avatar'
import { WheelCarousel } from '@/components/ui/wheel-carousel'
import { Link } from '@/i18n/navigation'

/** One line of a person's panel: a course, a cohort, a role. */
export type WheelLine = {
  key: string
  title: string
  sub?: string
  href?: string
  icon?: ReactNode
}

export type WheelPerson = {
  id: number
  slug: string
  name: string
  photo?: { url: string; alt: string; focalX?: number | null; focalY?: number | null }
  /** The small line above the name: "Fellow", "Trustee". */
  eyebrow: string
  lines: WheelLine[]
  /** The start of their bio, as plain text. */
  bio: string
}

/**
 * People on Componentry's wheel: turn it (scroll, drag or arrow keys) and
 * the panel beside it shows who is at the marker, a few lines about their
 * place at CILAS, the start of their bio and a link to their page.
 */
export function PeopleWheel({
  people,
  namespace,
}: {
  people: WheelPerson[]
  /** Its messages: wheel, announce ({name}, {n}, {total}), lines ({count}) and profile. */
  namespace: 'Fellows' | 'Cilasians' | 'Governance'
}) {
  const t = useTranslations(namespace)
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const person = people[index]
  if (!person) return null

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
      <div className="h-[440px] sm:h-[540px]">
        <WheelCarousel
          announce={(item, i, n) => t('announce', { name: item.label, n: i + 1, total: n })}
          apexInset={14}
          appear={false}
          contentWidth={820}
          dir={locale === 'ar' ? 'rtl' : 'ltr'}
          gap={24}
          items={people.map((p) => ({
            label: p.name,
            image: p.photo?.url,
            imageFocalPoint: p.photo,
            fallbackSeed: personAvatarSeed(p.id),
            imageAlt: p.photo?.alt || p.name,
          }))}
          label={t('wheel')}
          markerSize={8}
          onActiveChange={(_, i) => setIndex(i)}
          photoWidth={32}
          radius={280}
          spacing={13}
          // Few people: no need to show more than there are.
          visibleItems={Math.min(7, Math.max(2, Math.floor(people.length / 2)))}
        />
      </div>

      <section aria-live="polite" className="min-w-0">
        <p className="text-sm text-[var(--text-muted)]">{person.eyebrow}</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight rtl:tracking-normal" dir="auto">
          <Link className="underline-offset-4 hover:underline" href={`/people/${person.slug}`}>
            {person.name}
          </Link>
        </h2>

        {person.lines.length ? (
          <>
            <h3 className="mt-6 font-sans text-sm font-medium">
              {t('lines', { count: person.lines.length })}
            </h3>
            <ul className="mt-2 grid gap-2">
              {person.lines.map((line) => (
                <li className="grid grid-cols-[1rem_1fr] gap-x-3 text-sm" key={line.key}>
                  {line.icon ?? <span />}
                  <span>
                    {line.href ? (
                      <Link
                        className="underline-offset-4 hover:underline"
                        dir="auto"
                        href={line.href}
                      >
                        {line.title}
                      </Link>
                    ) : (
                      <span dir="auto">{line.title}</span>
                    )}
                    {line.sub ? (
                      <span className="block text-xs text-[var(--text-muted)]">{line.sub}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {person.bio ? (
          <p
            className="mt-6 line-clamp-6 text-sm leading-relaxed text-[var(--text-secondary)]"
            dir="auto"
          >
            {person.bio}
          </p>
        ) : null}

        <Link
          className="mt-6 inline-flex h-9 items-center rounded-full px-4 text-sm shadow-[0_0_0_1px_var(--border)] hover:bg-[var(--surface-muted)]"
          href={`/people/${person.slug}`}
        >
          {t('profile')}
        </Link>
      </section>
    </div>
  )
}

'use client'

import { LayoutList } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import type { WorkView } from './work-views'

/** The narrow-screen form of the top bar work links: one button that opens a short list. */
export function WorkMenu({ views }: { views: WorkView[] }) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  const box = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  // The header stays mounted across pages, so close the list on every move.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="cilas-work-menu">
      <button
        aria-controls={panel}
        aria-expanded={open}
        aria-label="Admin work"
        className="cilas-work-menu__button"
        onClick={() => setOpen((o) => !o)}
        ref={trigger}
        type="button"
      >
        <LayoutList aria-hidden size={16} />
      </button>
      {open ? (
        <nav aria-label="Admin work" className="cilas-work-menu__panel" id={panel}>
          {views.map(({ key, href, label }) => (
            <Link key={key} href={href}>
              {label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

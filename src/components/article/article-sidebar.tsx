'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function ArticleSidebar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    const resize = () => {
      const top = Math.max(0, node.getBoundingClientRect().top)
      node.style.setProperty(
        '--article-sidebar-height',
        `${Math.max(0, window.innerHeight - top - 16)}px`,
      )
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(node)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', resize)
    }
  }, [])

  return (
    <div ref={ref} className="article-sidebar sticky top-24">
      {children}
    </div>
  )
}

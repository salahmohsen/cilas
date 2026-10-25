'use client'

import { ArrowUpRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/arc/button/button'

/** The space head's way back to the course page. */
export function OpenCourseButton({ href, label }: { href: string; label: string }) {
  const router = useRouter()
  return (
    <Button variant="secondary" size="sm" onClick={() => router.push(href)}>
      {label}
      <ArrowUpRight size={16} aria-hidden="true" className="rtl:-scale-x-100" />
    </Button>
  )
}

'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/arc/button/button'

import styles from './space.module.css'

/** NN/g: "Load more" with a count keeps the footer reachable and the place findable. */
export function LoadMore({ href, label, status }: { href: string; label: string; status: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <div className={styles.feedBar}>
      <span className={`${styles.meta} ${styles.numeric}`}>{status}</span>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => start(() => router.replace(href, { scroll: false }))}
      >
        {label}
      </Button>
    </div>
  )
}

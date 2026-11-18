import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import { guardLeaving } from '@/lib/leave-guard'

import styles from './space.module.css'

export type LeaveWords = {
  title: string
  body: string
  stay: string
  go: string
  close: string
}

/**
 * While `unsaved` is true, leaving asks first (`lib/leave-guard.ts`): a link
 * inside the site, a navigation the app starts with `leave`, and closing the
 * page. Returns the question's dialog, for the host to render, and `leave`
 * for the host's own way out (a Cancel), which asks only while `unsaved`.
 */
export function useLeaveQuestion(
  unsaved: boolean,
  words: LeaveWords,
): { dialog: ReactNode; leave: (go: () => void) => void } {
  const router = useRouter()
  const [asking, setAsking] = useState<(() => void) | null>(null)

  useEffect(() => {
    if (!unsaved) return
    return guardLeaving({
      ask: (go) => setAsking(() => go),
      navigate: (href) => router.push(href),
    })
  }, [unsaved, router])

  const dialog = (
    <Dialog
      open={asking !== null}
      onOpenChange={(next) => {
        if (!next) setAsking(null)
      }}
    >
      <DialogContent title={words.title} description={words.body} closeLabel={words.close}>
        <div className={styles.leaveActions}>
          <DialogClose asChild>
            <Button type="button" variant="secondary" autoFocus>
              {words.stay}
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const go = asking
              setAsking(null)
              go?.()
            }}
          >
            {words.go}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
  const leave = useCallback((go: () => void) => (unsaved ? setAsking(() => go) : go()), [unsaved])
  return { dialog, leave }
}

import type { LucideIcon } from 'lucide-react'
import { Plus } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'

import styles from './card-list.module.css'

/** What is wrong with a draft, by field name; empty when it may be kept. */
export type CardIssues = Partial<Record<string, string>>

/**
 * One kind of row the list shows as cards: how a row looks on its card,
 * its dialog's fields, and the rule a draft must pass before Done keeps it.
 */
export type CardKind<T> = {
  blank: () => Omit<T, 'key'>
  /** `name` tells cards with the same title apart for assistive tech; the title by default. */
  face: (row: T, n: number) => { icon: LucideIcon; title: string; line: string; name?: string }
  issues: (draft: T) => CardIssues
  fields: (draft: T, set: (patch: Partial<T>) => void, issues: CardIssues) => ReactNode
  words: {
    /** The card's name: "Edit material: Reading list". */
    edit: (title: string) => string
    add: string
    addTitle: string
    editTitle: string
    remove: string
    cancel: string
    done: string
    close: string
  }
}

type Open<T> = { index: number | null; draft: T; tried: boolean }

/**
 * Rows as a grid of cards that end with a "+" tile. A card opens a dialog
 * with the row's fields; Done keeps the draft only when it passes the kind's
 * rule, so a card never holds an invalid row. Cancel keeps the row as it was,
 * and a new row that is cancelled is never added.
 */
export function CardList<T extends { key: string }>({
  kind,
  rows,
  onChange,
  newKey,
}: {
  kind: CardKind<T>
  rows: T[]
  onChange: (rows: T[]) => void
  newKey: () => string
}) {
  const [open, setOpen] = useState<Open<T> | null>(null)
  const [shown, setShown] = useState<Open<T> | null>(null)
  const list = useRef<HTMLUListElement>(null)
  const body = useRef<HTMLFormElement>(null)
  /** The card that takes focus when the dialog closes; null for the "+" tile. */
  const focusAfter = useRef<string | null>(null)

  const start = (next: Open<T>) => {
    focusAfter.current = next.index === null ? null : (rows[next.index]?.key ?? null)
    setOpen(next)
    setShown(next)
  }
  const close = () => setOpen(null)
  const issues = shown?.tried ? kind.issues(shown.draft) : {}

  const done = () => {
    if (!open) return
    const found = kind.issues(open.draft)
    if (Object.keys(found).length) {
      setOpen({ ...open, tried: true })
      setShown({ ...open, tried: true })
      requestAnimationFrame(() =>
        body.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"], button[data-invalid]')
          ?.focus(),
      )
      return
    }
    onChange(
      open.index === null
        ? [...rows, open.draft]
        : rows.map((row, i) => (i === open.index ? open.draft : row)),
    )
    focusAfter.current = open.draft.key
    close()
  }
  const remove = () => {
    if (open?.index == null) return
    const index = open.index
    focusAfter.current = rows[index + 1]?.key ?? rows[index - 1]?.key ?? null
    onChange(rows.filter((_, i) => i !== index))
    close()
  }
  const set = (patch: Partial<T>) => {
    if (!open) return
    const next = { ...open, draft: { ...open.draft, ...patch } }
    setOpen(next)
    setShown(next)
  }

  return (
    <>
      <ul ref={list} className={styles.cards}>
        {rows.map((row, i) => {
          const face = kind.face(row, i + 1)
          const Icon = face.icon
          return (
            <li key={row.key}>
              <button
                type="button"
                className={styles.card}
                data-key={row.key}
                aria-label={kind.words.edit(face.name ?? face.title)}
                onClick={() => start({ index: i, draft: row, tried: false })}
              >
                <Icon className={styles.icon} size={16} aria-hidden="true" />
                <span className={styles.title} dir="auto">
                  {face.title}
                </span>
                {face.line ? (
                  <span className={styles.line} dir="auto">
                    {face.line}
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            className={styles.add}
            data-add=""
            aria-label={kind.words.add}
            onClick={() =>
              start({ index: null, draft: { ...kind.blank(), key: newKey() } as T, tried: false })
            }
          >
            <Plus size={20} aria-hidden="true" />
          </button>
        </li>
      </ul>
      <Dialog open={open !== null} onOpenChange={(next) => (next ? null : close())}>
        {shown ? (
          <DialogContent
            className="arc-scope"
            title={shown.index === null ? kind.words.addTitle : kind.words.editTitle}
            closeLabel={kind.words.close}
            onOpenAutoFocus={(event) => {
              // The first field, not the close button in the header.
              event.preventDefault()
              body.current?.querySelector<HTMLElement>('button, input, textarea')?.focus()
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              const key = focusAfter.current
              const target =
                (key && list.current?.querySelector<HTMLElement>(`[data-key="${key}"]`)) ||
                list.current?.querySelector<HTMLElement>('[data-add]')
              target?.focus()
            }}
          >
            <form
              ref={body}
              noValidate
              className={styles.dialog}
              onSubmit={(event) => {
                // The dialog is portaled, but React still bubbles its submit to the session form.
                event.preventDefault()
                event.stopPropagation()
                done()
              }}
            >
              {kind.fields(shown.draft, set, issues)}
              <div className={styles.actions}>
                {shown.index !== null ? (
                  <Button type="button" variant="ghost" className={styles.remove} onClick={remove}>
                    {kind.words.remove}
                  </Button>
                ) : null}
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    {kind.words.cancel}
                  </Button>
                </DialogClose>
                <Button type="submit">{kind.words.done}</Button>
              </div>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}

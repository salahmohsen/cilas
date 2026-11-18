import type { LucideIcon } from 'lucide-react'
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'

import { moves, place } from './card-order'
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
    moveUp: string
    moveDown: string
    /** The live region's text: "Position 2 of 3". */
    position: (n: number, total: number) => string
  }
}

/** `to` is where the draft will sit once Done keeps it; it starts at the row's own place. */
type Open<T> = { index: number | null; draft: T; tried: boolean; to: number }

/**
 * Rows as full-width cards, reordered by dragging a grip, that end with a
 * dashed "+" row. A card opens a dialog with the row's fields and, with more
 * than one row, Move up and Move down for the draft's place. Done keeps the
 * draft only when it passes the kind's rule, so a card never holds an invalid
 * row. Cancel keeps the row and its place as they were, and a new row that is
 * cancelled is never added.
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
  const [announce, setAnnounce] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLFormElement>(null)
  const up = useRef<HTMLButtonElement>(null)
  const down = useRef<HTMLButtonElement>(null)
  /** The card that takes focus when the dialog closes; null for the "+" row. */
  const focusAfter = useRef<string | null>(null)
  /** The button that moved the draft last; when the move removes it, focus goes to the other one. */
  const pressed = useRef<HTMLButtonElement | null>(null)

  const show = (next: Open<T>) => {
    setOpen(next)
    setShown(next)
  }
  const start = (index: number | null, draft: T) => {
    focusAfter.current = index === null ? null : (rows[index]?.key ?? null)
    setAnnounce('')
    show({ index, draft, tried: false, to: index ?? rows.length })
  }
  const close = () => setOpen(null)
  const issues = shown?.tried ? kind.issues(shown.draft) : {}
  const total = rows.length + (shown?.index === null ? 1 : 0)
  const can = moves(shown?.to ?? 0, total)

  const done = () => {
    if (!open) return
    const found = kind.issues(open.draft)
    if (Object.keys(found).length) {
      show({ ...open, tried: true })
      requestAnimationFrame(() =>
        body.current
          ?.querySelector<HTMLElement>('[aria-invalid="true"], button[data-invalid]')
          ?.focus(),
      )
      return
    }
    onChange(place(rows, open.index, open.draft, open.to))
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
    if (open) show({ ...open, draft: { ...open.draft, ...patch } })
  }
  const move = (by: -1 | 1, button: HTMLButtonElement) => {
    if (!open) return
    const to = open.to + by
    show({ ...open, to })
    setAnnounce(kind.words.position(to + 1, total))
    pressed.current = button
  }

  const at = open?.to
  useEffect(() => {
    const button = pressed.current
    if (!button || button.isConnected) return
    pressed.current = null
    ;(up.current ?? down.current)?.focus()
  }, [at])

  return (
    <>
      <div ref={list} className={styles.list}>
        <Reorder.Group as="ul" axis="y" values={rows} onReorder={onChange} className={styles.cards}>
          {rows.map((row, i) => (
            <CardRow
              key={row.key}
              row={row}
              face={kind.face(row, i + 1)}
              name={kind.words.edit}
              draggable={rows.length > 1}
              onOpen={() => start(i, row)}
            />
          ))}
        </Reorder.Group>
        <button
          type="button"
          className={styles.add}
          data-add=""
          aria-label={kind.words.add}
          onClick={() => start(null, { ...kind.blank(), key: newKey() } as T)}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
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
              <p className={styles.srOnly} role="status" aria-live="polite">
                {announce}
              </p>
              {can.up || can.down ? (
                <div className={styles.move}>
                  {can.up ? (
                    <Button
                      ref={up}
                      type="button"
                      variant="secondary"
                      className={styles.moveButton}
                      onClick={(e) => move(-1, e.currentTarget)}
                    >
                      <ArrowUp size={16} aria-hidden="true" />
                      {kind.words.moveUp}
                    </Button>
                  ) : null}
                  {can.down ? (
                    <Button
                      ref={down}
                      type="button"
                      variant="secondary"
                      className={styles.moveButton}
                      onClick={(e) => move(1, e.currentTarget)}
                    >
                      <ArrowDown size={16} aria-hidden="true" />
                      {kind.words.moveDown}
                    </Button>
                  ) : null}
                </div>
              ) : null}
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

function CardRow<T extends { key: string }>({
  row,
  face,
  name,
  draggable,
  onOpen,
}: {
  row: T
  face: ReturnType<CardKind<T>['face']>
  name: (title: string) => string
  draggable: boolean
  onOpen: () => void
}) {
  const controls = useDragControls()
  const reduced = useReducedMotion()
  const Icon = face.icon
  return (
    <Reorder.Item
      as="li"
      value={row}
      dragListener={false}
      dragControls={controls}
      transition={reduced ? { duration: 0 } : undefined}
      className={styles.item}
    >
      <button
        type="button"
        className={styles.card}
        data-key={row.key}
        aria-label={name(face.name ?? face.title)}
        onClick={onOpen}
      >
        <Icon className={styles.icon} size={16} aria-hidden="true" />
        <span className={styles.copy}>
          <span className={styles.title} dir="auto">
            {face.title}
          </span>
          {face.line ? (
            <span className={styles.line} dir="auto">
              {face.line}
            </span>
          ) : null}
        </span>
      </button>
      {draggable ? (
        <span className={styles.grip} aria-hidden="true" onPointerDown={(e) => controls.start(e)}>
          <GripVertical size={16} />
        </span>
      ) : null}
    </Reorder.Item>
  )
}

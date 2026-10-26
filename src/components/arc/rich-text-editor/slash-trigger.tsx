'use client'

/**
 * The editor's floating triggers on one machinery: `/` proposes blocks (and
 * course sessions to place as blocks), `@` proposes members, `#` proposes
 * course sessions to name inline. Detection, rows, keyboard and the panel live here;
 * the editor keeps the state (its undo history closes the menu directly) and
 * threads its DOM helpers and history callbacks in.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useLayoutEffect,
  KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { animate, motion, useMotionValue, type Transition } from 'motion/react'
import {
  CalendarDays,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  SquareCode,
} from 'lucide-react'
import { motionTokens } from '../lib/motion-tokens'
import type { BlockType, SessionSuggestion, Slash } from './rich-text-editor'
import styles from './rich-text-editor.module.css'

/** A row of any menu: a block to apply, a member to mention, or a session to name or place. */
export type SlashItem = {
  type?: BlockType
  person?: { id: number; name: string }
  session?: SessionSuggestion
  /** The session goes in as a block of its own, not inline */
  block?: boolean
  label: string
  hint?: string
  keywords?: string
  icon?: ReactNode
}

const { spring, duration, ease } = motionTokens
const enter = [...ease.enter] as [number, number, number, number]
const standard = [...ease.standard] as [number, number, number, number]

export const physical = (visualDuration: number, bounce: number): Transition => {
  const root = (2 * Math.PI) / (visualDuration * 1.2)
  return { type: 'spring', stiffness: root * root, damping: 2 * (1 - bounce) * root, mass: 1 }
}
export const GLIDE = physical(0.3, 0.08)
export const GROW = physical(spring.smooth.visualDuration, 0)

const icon = { size: 16, strokeWidth: 1.75, 'aria-hidden': true } as const
export const SLASH_ITEMS: SlashItem[] = [
  {
    type: 'p',
    label: 'Text',
    hint: '',
    keywords: 'paragraph plain body',
    icon: <Pilcrow {...icon} />,
  },
  {
    type: 'h1',
    label: 'Heading 1',
    hint: '#',
    keywords: 'title h1 large',
    icon: <Heading1 {...icon} />,
  },
  {
    type: 'h2',
    label: 'Heading 2',
    hint: '##',
    keywords: 'subtitle h2 section',
    icon: <Heading2 {...icon} />,
  },
  {
    type: 'h3',
    label: 'Heading 3',
    hint: '###',
    keywords: 'h3 small',
    icon: <Heading3 {...icon} />,
  },
  {
    type: 'ul',
    label: 'Bulleted list',
    hint: '-',
    keywords: 'bullet unordered ul points',
    icon: <List {...icon} />,
  },
  {
    type: 'ol',
    label: 'Numbered list',
    hint: '1.',
    keywords: 'ordered ol steps numbers',
    icon: <ListOrdered {...icon} />,
  },
  {
    type: 'blockquote',
    label: 'Quote',
    hint: '>',
    keywords: 'blockquote citation callout',
    icon: <Quote {...icon} />,
  },
  {
    type: 'pre',
    label: 'Code block',
    hint: '```',
    keywords: 'pre snippet monospace',
    icon: <SquareCode {...icon} />,
  },
  {
    type: 'hr',
    label: 'Divider',
    hint: '---',
    keywords: 'rule hr line separator',
    icon: <Minus {...icon} />,
  },
]

const MARKERS = { slash: '/', mention: '@', session: '#' } as const

/** Under a session's title: its number and date. A session with no title shows its number as the title. */
const sessionMeta = ({ session, hint }: SlashItem) =>
  (session?.title ? [session.unit, hint] : [hint]).filter(Boolean).join(' · ')

/** `[@Name](/people/{id})` replaces the running `@query` token ending at `caret`; text with no trigger passes through. */
/**
 * Replaces the "@query" before the caret with a link to the person that shows
 * only their name; the Markdown export writes it back as `[@Name](/people/{id})`.
 * Returns the text node after the link, which starts with a space for the caret.
 */
export const insertMentionLink = (
  node: Text,
  caret: number,
  person: { id: number; name: string },
): Text | null => {
  const at = node.data.lastIndexOf('@', caret - 1)
  if (at < 0) return null
  const after = node.splitText(caret)
  node.deleteData(at, caret - at)
  const link = node.ownerDocument.createElement('a')
  link.setAttribute('href', `/people/${person.id}`)
  link.textContent = person.name
  after.parentNode!.insertBefore(link, after)
  if (!/^\s/.test(after.data)) after.insertData(0, ' ')
  return after
}

/**
 * Replaces the "#query" before the caret with a link to the session that
 * shows its short name; the Markdown export writes `[#3 Title](session:{id})`.
 * Returns the text node after the link, which starts with a space for the caret.
 */
export const insertSessionLink = (
  node: Text,
  caret: number,
  session: SessionSuggestion,
): Text | null => {
  const at = node.data.lastIndexOf('#', caret - 1)
  if (at < 0) return null
  const after = node.splitText(caret)
  node.deleteData(at, caret - at)
  const link = node.ownerDocument.createElement('a')
  link.setAttribute('href', `session:${session.id}`)
  link.textContent = session.mention
  after.parentNode!.insertBefore(link, after)
  if (!/^\s/.test(after.data)) after.insertData(0, ' ')
  return after
}

/** The menu survives only while the caret keeps heading its same trigger token; an invalid or drifting query closes it. */
export const pruneMenu = (open: Slash, range: Range): Slash | null => {
  const valid =
    range.collapsed &&
    range.startContainer === open.node &&
    range.startOffset > open.offset &&
    open.node.data[open.offset] === MARKERS[open.kind]
  const query = valid ? open.node.data.slice(open.offset + 1, range.startOffset) : ''
  if (!valid || query.length > 24 || /^\s/.test(query) || /\s\s/.test(query)) return null
  return query === open.query ? open : { ...open, query }
}

const slashOptionId = (uid: string, index: number) => `${uid}-slash-${index}`
export { slashOptionId }

export type SlashTriggerArgs = {
  slash: Slash | null
  setSlash: (value: Slash | null) => void
  slashActive: number
  setSlashActive: (value: number) => void
  slashRef: RefObject<Slash | null>
  editorRef: RefObject<HTMLDivElement | null>
  rootRef: RefObject<HTMLDivElement | null>
  clipBand: (element: HTMLElement) => { top: number; bottom: number }
  setBar: (value: null) => void
  run: (change: () => void) => void
  applyBlock: (type: BlockType, target?: HTMLElement | null) => void
  blockAt: (root: HTMLElement, node: Node | null) => HTMLElement | null
  placeCaret: (node: Node, offset: number) => void
  ensureFilled: (element: HTMLElement) => void
  announce: (message: string) => void
  /** Members for the @ menu; without them @ stays an ordinary character. */
  members?: { id: number; name: string }[]
  /** Sessions for the # menu and the / menu; without them # stays an ordinary character. */
  sessions?: SessionSuggestion[]
  placeSessionBlock?: (open: Slash, caret: number, session: SessionSuggestion) => void
  /** At 2 the / menu offers no Heading 1. */
  minHeading?: 1 | 2
}

export function useSlashTrigger({
  slash,
  setSlash,
  slashActive,
  setSlashActive,
  slashRef,
  editorRef,
  rootRef,
  clipBand,
  setBar,
  run,
  applyBlock,
  blockAt,
  placeCaret,
  ensureFilled,
  announce,
  members,
  sessions,
  placeSessionBlock,
  minHeading = 1,
}: SlashTriggerArgs) {
  /* The menu opens the moment its marker character lands, word-start only. */
  const openIfTyped = useCallback(
    (data: string | null) => {
      const editor = editorRef.current,
        root = rootRef.current
      const selection = window.getSelection()
      // `# ` (with a space) stays a heading: the menu closes as soon as the space lands.
      const kind =
        data === '/' ? 'slash' : data === '@' ? 'mention' : data === '#' ? 'session' : null
      if (
        !kind ||
        (kind === 'mention' && !members?.length) ||
        (kind === 'session' && !sessions?.length) ||
        !editor ||
        !root ||
        !selection?.rangeCount
      )
        return
      const range = selection.getRangeAt(0)
      const node = range.startContainer
      if (
        !range.collapsed ||
        node.nodeType !== Node.TEXT_NODE ||
        node.parentElement?.closest('pre, code')
      )
        return
      const text = node as Text
      const offset = range.startOffset - 1
      if (
        text.data[offset] !== MARKERS[kind] ||
        (offset > 0 && !/[\s\u00a0\u200b]/.test(text.data[offset - 1]!))
      )
        return
      // Real browsers all measure Ranges; jsdom does not, so a zero rect keeps the trigger usable there.
      const mark = document.createRange()
      mark.setStart(text, offset)
      mark.setEnd(text, offset + 1)
      const rect = mark.getBoundingClientRect?.() ?? { left: 0, top: 0, bottom: 0 }
      const box = root.getBoundingClientRect()
      const band = clipBand(root)
      const above =
        band.bottom - rect.bottom < 330 && rect.top - band.top > band.bottom - rect.bottom
      const room = above ? rect.top - band.top - 12 : band.bottom - rect.bottom - 12
      setSlash({
        kind,
        node: text,
        offset,
        query: '',
        // Session rows carry a name and a date, so their menu is wider.
        x: Math.max(
          0,
          Math.min(rect.left - box.left - 8, box.width - (sessions?.length ? 324 : 244)),
        ),
        y: above ? rect.top - box.top - 6 : rect.bottom - box.top + 6,
        above,
        max: Math.max(150, room),
      })
      setSlashActive(0)
      setBar(null)
    },
    [clipBand, editorRef, rootRef, members, sessions, setBar, setSlash, setSlashActive],
  )

  /* Rows: @ lists members, # sessions, / blocks then sessions to place; everything else identical. */
  const slashResults = useMemo<SlashItem[]>(() => {
    const query = slash?.query.trim().toLowerCase() ?? ''
    const sessionRow = (session: SessionSuggestion, block: boolean): SlashItem => ({
      session,
      block,
      label: session.label,
      hint: session.hint,
      keywords: `${block ? 'session ' : ''}${session.mention.replace(/^#/, '')} ${session.hint ?? ''}`,
      icon: <CalendarDays {...icon} />,
    })
    const rows: SlashItem[] =
      slash?.kind === 'mention'
        ? (members ?? []).map((person) => ({ person, label: person.name }))
        : slash?.kind === 'session'
          ? (sessions ?? []).map((session) => sessionRow(session, false))
          : [
              ...SLASH_ITEMS.filter((item) => minHeading === 1 || item.type !== 'h1'),
              ...(sessions ?? []).map((session) => sessionRow(session, true)),
            ]
    if (!query) return rows
    return rows.filter(
      (item) =>
        `${item.label} ${item.keywords ?? ''}`
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(query)) || item.label.toLowerCase().includes(query),
    )
  }, [slash?.kind, slash?.query, members, sessions, minHeading])
  // A query nothing matches closes the menu, so Enter and Escape act on the text again.
  useEffect(() => {
    if (slash && !slashResults.length) setSlash(null)
  }, [setSlash, slash, slashResults.length])
  const slashIndex = Math.min(slashActive, Math.max(0, slashResults.length - 1))
  const slashOpen = !!slash && slashResults.length > 0

  const choose = (item: SlashItem | undefined) => {
    const open = slashRef.current
    const editor = editorRef.current
    if (!item || !open || !editor) return
    const selection = window.getSelection()
    const caret =
      selection?.rangeCount && selection.getRangeAt(0).startContainer === open.node
        ? selection.getRangeAt(0).startOffset
        : open.offset + 1 + open.query.length
    if (item.person) {
      const person = item.person
      setSlash(null)
      run(() => {
        const after = insertMentionLink(open.node, Math.min(caret, open.node.data.length), person)
        if (after) placeCaret(after, 1)
      })
      announce(`${person.name} mentioned`)
      return
    }
    if (item.session) {
      const session = item.session
      const at = Math.min(caret, open.node.data.length)
      setSlash(null)
      run(() => {
        if (item.block) return placeSessionBlock?.(open, at, session)
        const after = insertSessionLink(open.node, at, session)
        if (after) placeCaret(after, 1)
      })
      announce(`${session.label} added`)
      return
    }
    setSlash(null)
    run(() => {
      open.node.deleteData(open.offset, Math.max(1, caret - open.offset))
      const block = blockAt(editor, open.node)
      placeCaret(open.node, open.offset)
      if (block) {
        ensureFilled(block)
        applyBlock(item.type ?? 'p', block)
      }
    })
    announce(`${item.label} added`)
  }

  const menuKey = (event: ReactKeyboardEvent<HTMLDivElement>): boolean => {
    if (!slashOpen) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setSlashActive(
        (slashIndex + (event.key === 'ArrowDown' ? 1 : -1) + slashResults.length) %
          slashResults.length,
      )
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      choose(slashResults[slashIndex])
      return true
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setSlash(null)
      return true
    }
    return false
  }

  return { slash, slashResults, slashIndex, slashOpen, openIfTyped, choose, menuKey }
}

/** The floating menu: the highlight glides between rows and the panel springs to its rows. */
export function SlashPanel({
  uid,
  slash,
  results,
  index,
  reduced,
  label,
  setActive,
  choose,
}: {
  uid: string
  slash: Slash
  results: SlashItem[]
  index: number
  reduced: boolean
  label: string
  setActive: (value: number) => void
  choose: (item: SlashItem | undefined) => void
}) {
  const listRef = useRef<HTMLUListElement>(null)
  const hy = useMotionValue(0),
    hh = useMotionValue(0),
    panelHeight = useMotionValue<number | 'auto'>('auto')
  const panelBody = useRef<HTMLDivElement>(null)
  const slashPanel = useRef<HTMLDivElement>(null)
  const slashMax = slash.max
  const panelSized = useRef(false)
  const highlightPlaced = useRef(false)
  useLayoutEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)
    if (!row) return
    if (reduced || !highlightPlaced.current || hh.get() === 0) {
      hy.jump(row.offsetTop)
      hh.jump(row.offsetHeight)
      highlightPlaced.current = true
      return
    }
    animate(hy, row.offsetTop, GLIDE)
    animate(hh, row.offsetHeight, GLIDE)
    // A short panel scrolls to keep the active row in view.
    const panel = slashPanel.current
    if (panel) {
      const top = row.offsetTop + 6,
        bottom = top + row.offsetHeight
      if (top - 6 < panel.scrollTop) panel.scrollTop = top - 6
      else if (bottom + 6 > panel.scrollTop + panel.clientHeight)
        panel.scrollTop = bottom + 6 - panel.clientHeight
    }
  }, [hh, hy, reduced, index, results])
  useLayoutEffect(() => {
    const body = panelBody.current
    if (!body) return
    const fit = () => {
      const target = Math.min(body.offsetHeight, slashMax)
      if (!panelSized.current || reduced) {
        panelHeight.jump(target)
        panelSized.current = true
        return
      }
      animate(panelHeight, target, GROW)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(body)
    return () => observer.disconnect()
  }, [panelHeight, reduced, slashMax])

  const optionId = (i: number) => slashOptionId(uid, i)

  return (
    <motion.div
      ref={slashPanel}
      className={styles.slash}
      data-above={slash.above || undefined}
      data-wide={results.some((item) => item.session) || undefined}
      style={{
        left: slash.x,
        top: slash.y,
        height: panelHeight,
        maxHeight: slashMax,
        transformOrigin: slash.above ? '16px 100%' : '16px 0',
      }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: slash.above ? 4 : -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={
        reduced
          ? { opacity: 0 }
          : {
              opacity: 0,
              scale: 0.97,
              transition: { duration: duration.exit * 0.8, ease: standard },
            }
      }
      transition={
        reduced
          ? { duration: duration.fast }
          : { ...spring.snappy, opacity: { duration: duration.fast, ease: enter } }
      }
      onMouseDown={(event) => event.preventDefault()}
    >
      <div ref={panelBody} className={styles.slashBody}>
        <ul
          ref={listRef}
          id={`${uid}-slash`}
          role="listbox"
          aria-label={label}
          className={styles.slashList}
        >
          <motion.li
            aria-hidden="true"
            className={styles.slashHighlight}
            style={{ y: hy, height: hh }}
          />
          {results.map((item, i) => (
            <li
              key={
                item.person
                  ? `p${item.person.id}`
                  : item.session
                    ? `${item.block ? 'b' : 's'}${item.session.id}`
                    : item.type
              }
              id={optionId(i)}
              role="option"
              aria-selected={i === index}
              data-index={i}
              data-stacked={item.session ? '' : undefined}
              className={styles.slashOption}
              onPointerMove={() => {
                if (i !== index) setActive(i)
              }}
              onClick={() => choose(item)}
            >
              {item.icon && <span className={styles.slashIcon}>{item.icon}</span>}
              {item.session ? (
                // A long session title wraps to two lines over its number and date.
                <span className={styles.slashStack}>
                  <span
                    className={styles.slashTitle}
                    dir="auto"
                    title={item.session.title || item.label}
                  >
                    {item.session.title || item.label}
                  </span>
                  {sessionMeta(item) && (
                    <span className={styles.slashNote}>{sessionMeta(item)}</span>
                  )}
                </span>
              ) : (
                <>
                  <span className={styles.slashLabel}>
                    {item.person ? `@${item.label}` : item.label}
                  </span>
                  {item.hint && <kbd className={styles.slashHint}>{item.hint}</kbd>}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

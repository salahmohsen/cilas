'use client'

import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { FormEvent, ReactNode } from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useAnimate, useReducedMotion } from 'motion/react'
import type { Variants } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import AnimatedCounter from '../../animated-counter/animated-counter'
import { ScrollArea } from '../../scroll-area/scroll-area'
import SegmentedControl from '../../segmented-control/segmented-control'
import { Switch } from '../../switch/switch'
import { motionTokens } from '../../lib/motion-tokens'
import { newsletterCopy, newsletterPublication, newsletterReaders } from './newsletter-signup-data'
import type { NewsletterIssue, NewsletterPublication } from './newsletter-signup-data'
import styles from './newsletter-signup.module.css'

export type {
  NewsletterIssue,
  NewsletterPublication,
  NewsletterStory,
} from './newsletter-signup-data'
export type NewsletterVariant = 'inline' | 'card' | 'panel'

export interface NewsletterSignupProps {
  /** `inline` puts the copy and form beside the issue stack; `card` is a self-contained card with the stack in a tray on top; `panel` is the inline layout as a bordered surface that fits a text column. */
  variant?: NewsletterVariant
  title?: string
  description?: string
  placeholder?: string
  buttonLabel?: string
  /** Short line under the form about frequency and privacy. */
  privacyNote?: ReactNode
  /** Link after the privacy note. Pass null to hide it. */
  privacyLink?: { label: string; href: string } | null
  /** Reader count and up to three faces. The count ticks up by one when someone subscribes. Pass null to hide it. */
  readers?: { count: number; faces: string[] } | null
  /** The issue stack. On success the upcoming issue, addressed to the new reader, lands on top. Pass null for a form without the stack. */
  publication?: NewsletterPublication | null
  /** Called with a valid, trimmed email. Reject to show an error and keep the email; resolve to show the success state. */
  onSubscribe?: (email: string) => void | Promise<void>
  /** The built-in strings, for another language. Any left out stay English. */
  text?: Partial<NewsletterText>
  className?: string
}

type Phase = 'idle' | 'sending' | 'done'
type Problem = { kind: 'invalid' | 'failed'; text: string }
type Bezier = [number, number, number, number]
const enter = [...motionTokens.ease.enter] as Bezier
const standard = [...motionTokens.ease.standard] as Bezier
/** Every built-in string, so a host can translate the block. */
export interface NewsletterText {
  empty: string
  format: string
  failed: string
  emailLabel: string
  retry: string
  sending: string
  subscribed: string
  /** The confirmation line after a successful signup. */
  done: string
  again: string
  sentTo: (email: string) => string
  issue: (number: number) => string
  issueLabel: (name: string, number: number) => string
  to: string
  minutes: (minutes: number) => string
  readers: string
  includingYou: string
}
const DEFAULT_TEXT: NewsletterText = {
  empty: 'Enter your email address',
  format: 'Enter an email like name@company.com',
  failed: "That didn't go through. Your email is kept, so try again.",
  emailLabel: 'Email address',
  retry: 'Try again',
  sending: 'Subscribing',
  subscribed: 'Subscribed',
  done: 'Check your inbox to confirm.',
  again: 'Use a different email',
  sentTo: (email) => `The link went to ${email}.`,
  issue: (number) => `Issue ${number}`,
  issueLabel: (name, number) => `${name}, issue ${number}`,
  to: 'To',
  minutes: (minutes) => `${minutes} min`,
  readers: 'readers',
  includingYou: ', including you',
}
const TextContext = createContext<NewsletterText>(DEFAULT_TEXT)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** How far each issue behind the front one peeks out above it. */
const STEP = 12
/** The rows `.storiesViewport` is sized to; more than this and the list scrolls. */
const VISIBLE_STORIES = 3

function validate(value: string, text: NewsletterText): Problem | null {
  const email = value.trim()
  if (!email) return { kind: 'invalid', text: text.empty }
  if (!EMAIL.test(email)) return { kind: 'invalid', text: text.format }
  return null
}

const swapIn = { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }
const swapShown = { opacity: 1, y: 0, filter: 'blur(0px)' }
const swapOut = {
  opacity: 0,
  y: -6,
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: standard },
}
const fadeIn = { opacity: 0 }
const fadeOut = { opacity: 0, transition: { duration: motionTokens.duration.instant } }

/** A line that swaps in place: the old text lifts away and the new one rises out of a soft blur. */
function Swap({
  id,
  children,
  reduced,
  className,
  live,
}: {
  id: string
  children: ReactNode
  reduced: boolean
  className?: string
  live?: 'polite'
}) {
  return (
    <div className={className} aria-live={live}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={id}
          initial={reduced ? fadeIn : swapIn}
          animate={swapShown}
          exit={reduced ? fadeOut : swapOut}
          transition={{
            duration: reduced ? motionTokens.duration.instant : motionTokens.duration.standard,
            ease: enter,
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** One issue: masthead, recipient line, subject, and three stories with thumbnails. */
function IssueCard({ issue, name, to }: { issue: NewsletterIssue; name: string; to?: string }) {
  const text = useContext(TextContext)
  const stories = (
    <ul className={styles.stories}>
      {issue.stories.map((story, index) => (
        <li key={`${index}-${story.title}`} className={styles.story}>
          {story.image ? (
            <Image
              className={styles.thumb}
              src={story.image}
              alt=""
              width={88}
              height={88}
              sizes="44px"
              style={story.imageStyle}
            />
          ) : (
            <span className={styles.thumb} aria-hidden="true" />
          )}
          <span className={styles.storyTitle} dir="auto">
            {story.title}
          </span>
          {story.minutes ? (
            <span className={styles.minutes}>{text.minutes(story.minutes)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
  return (
    <>
      <header className={styles.issueHead}>
        <span className={styles.masthead}>{name}</span>
        <span className={styles.issueNumber}>{text.issue(issue.number)}</span>
      </header>
      <p className={styles.issueMeta}>
        <span className={styles.issueDate}>{issue.date}</span>
        {to && (
          <>
            <span aria-hidden="true">&middot;</span>
            <span className={styles.recipient}>
              {text.to} <span className={styles.recipientEmail}>{to}</span>
            </span>
          </>
        )}
      </p>
      <h3 className={styles.subject} dir="auto">
        {issue.subject}
      </h3>
      {issue.stories.length > VISIBLE_STORIES ? (
        <ScrollArea
          label={text.issueLabel(name, issue.number)}
          viewportClassName={styles.storiesViewport}
        >
          {stories}
        </ScrollArea>
      ) : (
        stories
      )}
    </>
  )
}

type Placement = { depth: number; upcoming: boolean }
/** The front issue sits flat; each one behind steps up and shrinks a little so its top edge shows. */
const stackVariants: Variants = {
  placed: ({ depth }: Placement) => ({ opacity: 1, y: -depth * STEP, scale: 1 - depth * 0.045 }),
  // The upcoming issue arrives from below, where the form is; older ones slide in from behind.
  away: ({ upcoming }: Placement) =>
    upcoming ? { opacity: 0, y: 56, scale: 1 } : { opacity: 0, y: -3 * STEP, scale: 1 - 3 * 0.045 },
}
/** Position rides the no-overshoot spring; opacity resolves fast so two issues never read through each other. */
const settle = {
  ...motionTokens.spring.smooth,
  opacity: { duration: motionTokens.duration.instant, ease: standard },
}
/** Reduced motion: issues take their places at once and only fade. */
const still = { duration: 0, opacity: { duration: motionTokens.duration.fast } }

/**
 * A stack of recent issues. When someone subscribes, the upcoming issue, addressed to them, lands on the front
 * and the older ones step back; the oldest drops away.
 */
function IssueStack({
  publication,
  delivered,
  to,
  reduced,
  compact,
}: {
  publication: NewsletterPublication
  delivered: boolean
  to: string
  reduced: boolean
  compact?: boolean
}) {
  const text = useContext(TextContext)
  const issues = (
    delivered ? [publication.upcoming, ...publication.recent] : publication.recent
  ).slice(0, 3)
  return (
    <div className={styles.stack} data-compact={compact ? '' : undefined}>
      {/* An unseen copy of the upcoming issue keeps the stack as tall as the tallest issue it will ever hold. */}
      <div className={`${styles.issue} ${styles.issueSizer}`} aria-hidden="true">
        <IssueCard issue={publication.upcoming} name={publication.name} to={to || ' '} />
      </div>
      <AnimatePresence initial={false}>
        {issues.map((issue, depth) => {
          const upcoming = issue === publication.upcoming
          const placement: Placement = { depth, upcoming }
          return (
            <motion.article
              key={issue.number}
              className={styles.issue}
              data-depth={depth}
              aria-hidden={depth > 0 ? true : undefined}
              inert={depth > 0}
              aria-label={depth === 0 ? text.issueLabel(publication.name, issue.number) : undefined}
              custom={placement}
              variants={stackVariants}
              initial="away"
              animate="placed"
              exit="away"
              transition={reduced ? still : settle}
              style={{ zIndex: 3 - depth }}
            >
              <IssueCard issue={issue} name={publication.name} to={upcoming ? to : undefined} />
            </motion.article>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

/** Faces and a reader count that ticks up by one when you join. */
function Readers({
  readers,
  done,
  reduced,
}: {
  readers: { count: number; faces: string[] }
  done: boolean
  reduced: boolean
}) {
  const text = useContext(TextContext)
  return (
    <div className={styles.readers}>
      <span className={styles.faces} aria-hidden="true">
        {readers.faces.slice(0, 3).map((src) => (
          <Image key={src} src={src} alt="" width={56} height={56} sizes="28px" />
        ))}
      </span>
      <span className={styles.readerLine}>
        <span className={styles.count}>
          <AnimatedCounter value={readers.count + (done ? 1 : 0)} />
        </span>{' '}
        {text.readers}
        <AnimatePresence initial={false}>
          {/* The phrase opens its own width on the no-overshoot spring, so the centred line glides instead of jumping sideways. */}
          {done && (
            <motion.span
              key="you"
              className={styles.you}
              initial={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, width: 'auto' }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, width: 0 }}
              transition={
                reduced
                  ? { duration: motionTokens.duration.instant }
                  : {
                      width: motionTokens.spring.smooth,
                      opacity: {
                        duration: motionTokens.duration.standard,
                        ease: enter,
                        delay: 0.12,
                      },
                    }
              }
            >
              {text.includingYou}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </div>
  )
}

/**
 * A newsletter signup framed by the newsletter itself: a stack of recent issues. Subscribing drops the next issue,
 * addressed to the new reader, onto the front of the stack and ticks the reader count up by one.
 * Comes as an inline page section or a self-contained card.
 */
export const NewsletterSignup = forwardRef<HTMLElement, NewsletterSignupProps>(
  function NewsletterSignup(
    {
      variant = 'inline',
      title,
      description,
      placeholder = 'you@company.com',
      buttonLabel = 'Subscribe',
      privacyNote = newsletterCopy.privacy,
      privacyLink = newsletterCopy.privacyLink,
      readers = newsletterReaders,
      publication = newsletterPublication,
      onSubscribe,
      text: textProp,
      className,
    },
    ref,
  ) {
    const text = useMemo(() => ({ ...DEFAULT_TEXT, ...textProp }), [textProp])
    const id = useId()
    const reduced = !!useReducedMotion()
    const [email, setEmail] = useState('')
    const [problem, setProblem] = useState<Problem | null>(null)
    const [tried, setTried] = useState(false)
    const [phase, setPhase] = useState<Phase>('idle')
    const [sentTo, setSentTo] = useState('')
    const input = useRef<HTMLInputElement>(null)
    const again = useRef<HTMLButtonElement>(null)
    const busy = useRef(false)
    const refocus = useRef(false)
    const [pill, animatePill] = useAnimate<HTMLDivElement>()
    // The panel is the inline layout, so it takes the inline sample copy.
    const copy = newsletterCopy[variant === 'card' ? 'card' : 'inline']

    useEffect(() => {
      if (phase === 'idle' && refocus.current) {
        refocus.current = false
        input.current?.focus()
      }
      if (phase === 'done') again.current?.focus()
    }, [phase])

    function shake() {
      if (reduced || !pill.current) return
      animatePill(pill.current, { x: [0, -6, 5, -3, 1, 0] }, { duration: 0.36, ease: 'easeOut' })
    }

    async function submit(event: FormEvent) {
      event.preventDefault()
      if (busy.current || phase !== 'idle') return
      setTried(true)
      const found = validate(email, text)
      setProblem(found)
      if (found) {
        shake()
        input.current?.focus()
        return
      }
      const value = email.trim()
      busy.current = true
      setPhase('sending')
      try {
        await (onSubscribe
          ? onSubscribe(value)
          : new Promise((resolve) => setTimeout(resolve, 1100)))
        setSentTo(value)
        setPhase('done')
      } catch {
        setPhase('idle')
        setProblem({ kind: 'failed', text: text.failed })
        shake()
      } finally {
        busy.current = false
      }
    }

    function reset() {
      setEmail('')
      setProblem(null)
      setTried(false)
      refocus.current = true
      setPhase('idle')
    }

    const done = phase === 'done'
    const sending = phase === 'sending'
    const messageId = `${id}-message`
    const labelKey = done
      ? 'done'
      : sending
        ? 'sending'
        : problem?.kind === 'failed'
          ? 'retry'
          : 'idle'
    const labels: Record<string, ReactNode> = {
      idle: (
        <>
          {buttonLabel}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </>
      ),
      retry: (
        <>
          {text.retry}
          <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
        </>
      ),
      sending: (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          {text.sending}
        </>
      ),
      done: (
        <>
          <span className={styles.check} aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={reduced ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: reduced ? 0 : 0.34, ease: enter, delay: 0.12 }}
              />
            </svg>
          </span>
          {text.subscribed}
        </>
      ),
    }

    const doneText = text.done
    const note = (
      <>
        {privacyNote}
        {privacyLink && (
          <>
            {' '}
            <a className={styles.link} href={privacyLink.href}>
              {privacyLink.label}
            </a>
          </>
        )}
      </>
    )
    // Plain copies of the note and the confirmation, used only to reserve the line's height.
    const measures = [
      <>
        {privacyNote}
        {privacyLink && ` ${privacyLink.label}`}
      </>,
      `${doneText} ${text.again}`,
      text.empty,
      text.format,
      text.failed,
    ]
    const form = (
      <form className={styles.form} onSubmit={submit} noValidate aria-label={title ?? copy.title}>
        <motion.div
          ref={pill}
          className={styles.pill}
          data-invalid={problem ? '' : undefined}
          data-done={done ? '' : undefined}
        >
          <label htmlFor={`${id}-email`} className={styles.srOnly}>
            {text.emailLabel}
          </label>
          <input
            ref={input}
            id={`${id}-email`}
            className={styles.input}
            dir="ltr"
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            enterKeyHint="send"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={placeholder}
            value={email}
            readOnly={phase !== 'idle'}
            aria-invalid={problem?.kind === 'invalid' ? true : undefined}
            aria-describedby={messageId}
            onBlur={() => {
              if (email.trim() && !tried && phase === 'idle') {
                setTried(true)
                setProblem(validate(email, text))
              }
            }}
            onChange={(event) => {
              setEmail(event.target.value)
              if (tried) setProblem(validate(event.target.value, text))
              else if (problem) setProblem(null)
            }}
          />
          <motion.button
            type={done ? 'button' : 'submit'}
            className={styles.submit}
            data-state={labelKey}
            aria-busy={sending || undefined}
            aria-disabled={sending || done || undefined}
            tabIndex={done ? -1 : undefined}
            whileTap={{ scale: reduced || sending || done ? 1 : 0.97 }}
            transition={motionTokens.spring.snappy}
          >
            <span className={styles.labels}>
              {Object.keys(labels).map((key) => (
                <span key={key} className={styles.sizer} aria-hidden="true">
                  {key === 'done' ? (
                    <>
                      <span className={styles.check} />
                      {text.subscribed}
                    </>
                  ) : (
                    labels[key]
                  )}
                </span>
              ))}
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={labelKey}
                  className={styles.label}
                  initial={reduced ? fadeIn : swapIn}
                  animate={swapShown}
                  exit={reduced ? fadeOut : swapOut}
                  transition={{
                    duration: reduced
                      ? motionTokens.duration.instant
                      : motionTokens.duration.standard,
                    ease: enter,
                  }}
                >
                  {labels[labelKey]}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.button>
        </motion.div>
        <div className={styles.message}>
          {/* Every message the line can show sits here unseen, so the line is always as tall as the longest one and nothing below it moves. */}
          {measures.map((text, index) => (
            <p key={index} className={`${styles.note} ${styles.sizer}`} aria-hidden="true">
              {text}
            </p>
          ))}
          <Swap
            id={problem ? `problem-${problem.text}` : done ? 'done' : 'note'}
            reduced={reduced}
            className={styles.messageLive}
            live="polite"
          >
            <p
              id={messageId}
              className={styles.note}
              data-tone={problem ? 'error' : done ? 'success' : undefined}
              role={problem ? 'alert' : undefined}
            >
              {problem?.text ??
                (done ? (
                  <>
                    {doneText}
                    <span className={styles.srOnly}> {text.sentTo(sentTo)}</span>{' '}
                    <button ref={again} type="button" className={styles.textButton} onClick={reset}>
                      {text.again}
                    </button>
                  </>
                ) : (
                  note
                ))}
            </p>
          </Swap>
        </div>
      </form>
    )

    const root = [styles.newsletter, className].filter(Boolean).join(' ')

    if (variant === 'card') {
      return (
        <TextContext.Provider value={text}>
          <section ref={ref} className={root} data-variant="card" aria-labelledby={`${id}-title`}>
            {/* The shell spans the section so a host layout can set its gutter without reaching into the card. */}
            <div className={styles.cardShell}>
              <div className={styles.card}>
                {publication && (
                  <div className={styles.tray}>
                    <IssueStack
                      publication={publication}
                      delivered={done}
                      to={sentTo}
                      reduced={reduced}
                      compact
                    />
                  </div>
                )}
                <div className={styles.cardBody}>
                  <h2 id={`${id}-title`} className={styles.cardTitle}>
                    {title ?? copy.title}
                  </h2>
                  <p className={styles.description}>{description ?? copy.description}</p>
                  {form}
                  {readers && <Readers readers={readers} done={done} reduced={reduced} />}
                </div>
              </div>
            </div>
          </section>
        </TextContext.Provider>
      )
    }

    return (
      <TextContext.Provider value={text}>
        <section
          ref={ref}
          className={root}
          data-variant={variant}
          data-aside={publication || readers ? '' : undefined}
          aria-labelledby={`${id}-title`}
        >
          <div className={styles.inline}>
            <div className={styles.intro}>
              <h2 id={`${id}-title`} className={styles.title}>
                {title ?? copy.title}
              </h2>
              <p className={styles.description}>{description ?? copy.description}</p>
              {form}
            </div>
            {(publication || readers) && (
              <div className={styles.aside}>
                {publication && (
                  <IssueStack
                    publication={publication}
                    delivered={done}
                    to={sentTo}
                    reduced={reduced}
                  />
                )}
                {readers && <Readers readers={readers} done={done} reduced={reduced} />}
              </div>
            )}
          </div>
        </section>
      </TextContext.Provider>
    )
  },
)

NewsletterSignup.displayName = 'NewsletterSignup'

const variantOptions = [
  { value: 'inline', label: 'Inline' },
  { value: 'card', label: 'Card' },
]

/** Preview: both layouts. Subscribing is simulated and nothing is sent; the switch makes the next send fail. */
export function NewsletterSignupBlock() {
  const [variant, setVariant] = useState<NewsletterVariant>('inline')
  const [fail, setFail] = useState(false)
  const switchId = useId()
  const simulate = () =>
    new Promise<void>((resolve, reject) =>
      setTimeout(() => (fail ? reject(new Error('Simulated failure')) : resolve()), 1100),
    )
  return (
    <div className={styles.preview}>
      <div className={styles.controls}>
        <SegmentedControl
          label="Newsletter layout"
          options={variantOptions}
          value={variant}
          onValueChange={(next) => setVariant(next as NewsletterVariant)}
        />
        <div className={styles.simulate}>
          <Switch id={switchId} checked={fail} onCheckedChange={setFail} />
          <label htmlFor={switchId}>Fail the next send</label>
        </div>
      </div>
      <div className={styles.frame}>
        <NewsletterSignup key={variant} variant={variant} onSubscribe={simulate} />
      </div>
      <p className={styles.caption}>Subscribing is simulated in this preview. Nothing is sent.</p>
    </div>
  )
}

export default NewsletterSignupBlock

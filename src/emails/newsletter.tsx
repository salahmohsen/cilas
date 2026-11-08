import { CAIRO } from '@/lib/cairo-day'
import { emailRichTextHTML } from './rich-text'
import type { RichTextReferences } from '@/lib/rich-text-references'
import { env } from '@/env'
import type { ReactNode } from 'react'
import { Column, Heading, Img, Link, Row, Section, Text } from 'react-email'

import { cardOf, type Card, type Person } from './cards'
import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import { pickItemOf } from './pick-types'
import type { EmailSettings } from './settings'
import { editableIn, type Editable } from '@/lib/editable'
import { colors, link, linkCss, type } from './theme'

type Media = { url?: string | null; alt?: string | null } | number | null | undefined

type Row = { id?: string | null }

export type Section = Row & { body?: unknown }

export type Issue = {
  references?: RichTextReferences
  title: string
  preheader?: string | null
  issue_date?: string | null
  cover_image?: unknown
  cover_caption?: unknown
  sections?: Section[] | null
}

const monthOf = (date?: string | null) =>
  date
    ? new Date(date).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: CAIRO,
      })
    : null

const richHtml = (data: unknown, references: RichTextReferences = {}) =>
  data
    ? emailRichTextHTML(data, references, env.NEXT_PUBLIC_SERVER_URL)
        .replace(
          /<(p|h[1-6]|li|blockquote|ul|ol)(\s|>)/g,
          (_, tag: string, next: string) => `<${tag} dir="auto"${next}`,
        )
        // Links in the site's style, not the mail app's blue.
        .replace(/<a /g, `<a style="${linkCss}" `)
    : ''

const urlOf = (media: Media) => {
  const m = media as { url?: string | null; alt?: string | null } | null
  return m && typeof m === 'object' && m.url?.startsWith('http')
    ? { url: m.url, alt: m.alt ?? '' }
    : null
}

/** "by A, B and C", each name linked to its profile when it has one. */
function Byline({ people, size = 16 }: { people: Person[]; size?: 13 | 16 }) {
  if (!people.length) return null
  return (
    <Text dir="auto" style={{ ...type[size], color: colors.fg, margin: '0 0 8px' }}>
      by{' '}
      {people.map((p, i) => (
        <span key={`${p.name}${i}`}>
          {i > 0 ? (i === people.length - 1 ? ' and ' : ', ') : null}
          {p.url ? (
            <Link href={p.url} style={{ ...link, color: colors.fg }}>
              {p.name}
            </Link>
          ) : (
            p.name
          )}
        </span>
      ))}
    </Text>
  )
}

/** A text cut at a word, for the compact cards of a cycle's courses. */
const shorten = (text: string | null, length: number) =>
  text && text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, '')}…` : text

function CardText({ card, pe, path }: { card: Card; pe: Editable; path?: string }) {
  return (
    <>
      <Text style={{ ...type[13], margin: '0 0 4px' }}>
        {[card.kind, card.meta].filter(Boolean).join(' · ')}
      </Text>
      <Text dir="auto" style={{ ...type[20], margin: '0 0 6px' }}>
        <Link href={card.url} style={{ color: colors.fg, textDecoration: 'none' }}>
          {card.title}
        </Link>
      </Text>
      <Byline people={card.byline} />
      {card.text ? (
        <Text dir="auto" style={{ ...type[16], margin: '0 0 8px' }}>
          {card.text}
        </Text>
      ) : null}
      {card.note ? (
        <Text
          dir="auto"
          style={{ ...type[16], color: colors.fg, margin: '0 0 8px' }}
          {...(path ? pe(`${path}.note`) : {})}
        >
          {card.note}
        </Text>
      ) : null}
      <Link href={card.url} style={{ ...type[16], ...link }}>
        {card.button} →
      </Link>
    </>
  )
}

/** One pick: its image full width on top, its words below. */
function StackedCard({
  card,
  last,
  pe,
  path,
  id,
}: {
  card: Card
  last: boolean
  pe: Editable
  /** The pick's data path, e.g. `sections.0.items.2`. */
  path: string
  id?: string | null
}) {
  return (
    <Section style={{ marginBottom: last ? 0 : '44px' }} {...pe(path, { row: { id } })}>
      {card.image ? (
        <Link href={card.url}>
          <Img
            className="m-img"
            src={card.image.url}
            alt={card.image.alt}
            width={552}
            style={{ display: 'block', width: '100%', borderRadius: '12px', marginBottom: '20px' }}
          />
        </Link>
      ) : null}
      <CardText card={card} pe={pe} path={path} />
      {card.children.length ? <CourseGrid cards={card.children} /> : null}
    </Section>
  )
}

/** A cycle's courses: compact cards, two to a row (one on phones). */
function CourseGrid({ cards }: { cards: Card[] }) {
  const rows: Card[][] = []
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2))
  return (
    <Section style={{ marginTop: '28px' }}>
      {rows.map((row, r) => (
        <Row key={r} style={{ marginBottom: r === rows.length - 1 ? 0 : '28px' }}>
          {[0, 1].map((c) => {
            const card = row[c]
            return (
              <Column
                key={c}
                className="m-col"
                style={{
                  width: '50%',
                  verticalAlign: 'top',
                  [c === 0 ? 'paddingRight' : 'paddingLeft']: '10px',
                }}
              >
                {card ? (
                  <>
                    {card.image ? (
                      <Link href={card.url}>
                        <Img
                          className="m-img"
                          src={card.image.thumb}
                          alt={card.image.alt}
                          width={266}
                          style={{
                            display: 'block',
                            width: '100%',
                            borderRadius: '10px',
                            marginBottom: '12px',
                          }}
                        />
                      </Link>
                    ) : null}
                    <Text
                      dir="auto"
                      style={{ ...type[16], fontWeight: 600, color: colors.fg, margin: '0 0 4px' }}
                    >
                      <Link href={card.url} style={{ color: colors.fg, textDecoration: 'none' }}>
                        {card.title}
                      </Link>
                    </Text>
                    <Byline people={card.byline} size={13} />
                    {card.text ? (
                      <Text
                        dir="auto"
                        style={{ ...type[13], color: colors.fg2, margin: '0 0 6px' }}
                      >
                        {shorten(card.text, 110)}
                      </Text>
                    ) : null}
                    <Link href={card.url} style={{ ...type[13], ...link }}>
                      {card.button} →
                    </Link>
                  </>
                ) : null}
              </Column>
            )
          })}
        </Row>
      ))}
    </Section>
  )
}

type EmailNode = { type: string; children?: EmailNode[]; fields?: Record<string, unknown> }
type BodyContext = { settings: EmailSettings; references?: RichTextReferences; title: string }
type BlockProps = BodyContext & { fields: Record<string, unknown> }

/** The visual editor selects a whole section, so nothing inside a body is marked. */
const unmarked = editableIn(false)

function Picks({ fields, settings }: BlockProps) {
  const t = settings.texts.newsletter
  const labels = { site: settings.site, read: t.read, apply: t.apply }
  const items = (fields.items ?? []) as Array<
    Row & Record<string, unknown> & { note?: string | null }
  >
  const cards = items.flatMap((p) => {
    const item = pickItemOf(p)
    const card = item ? cardOf(item, p.note, labels) : null
    return card ? [{ card, id: p.id }] : []
  })
  if (!cards.length) return null
  const heading = fields.heading as string | null | undefined
  return (
    <Section>
      {heading ? (
        <Heading as="h2" dir="auto" style={{ ...type[28], margin: '0 0 32px' }}>
          {heading}
        </Heading>
      ) : null}
      {cards.map(({ card, id }, i) => (
        <StackedCard
          key={`${card.url}${i}`}
          card={card}
          last={i === cards.length - 1}
          pe={unmarked}
          path=""
          id={id}
        />
      ))}
    </Section>
  )
}

/** What reads under an image: its caption, else its alt. An alt that only repeats the issue title says nothing. */
const textUnder = (caption: string | null | undefined, alt: string | undefined, title: string) => {
  const own = caption?.trim()
  if (own) return own
  const described = alt?.trim()
  return described && described !== title.trim() ? described : null
}

function BodyImage({ fields, title }: BlockProps) {
  const image = urlOf(fields.image as Media)
  if (!image) return null
  const caption = textUnder(fields.caption as string | null | undefined, image.alt, title)
  return (
    <>
      <Img
        src={image.url}
        alt={image.alt}
        width={552}
        style={{ display: 'block', width: '100%', borderRadius: '10px' }}
      />
      {caption ? (
        <Text dir="auto" style={{ ...type[13], margin: '8px 0 0' }}>
          {caption}
        </Text>
      ) : null}
    </>
  )
}

function Gallery({ fields }: BlockProps) {
  const columns = Math.min(Math.max(Number(fields.columnCount ?? 2), 1), 4)
  const rows_ = (fields.images ?? []) as Array<{ image?: Media; caption?: string | null }>
  const images = rows_.flatMap((i) => {
    const image = urlOf(i.image)
    return image ? [{ ...image, caption: i.caption?.trim() || null }] : []
  })
  const rows: (typeof images)[] = []
  for (let i = 0; i < images.length; i += columns) rows.push(images.slice(i, i + columns))
  return (
    <>
      {rows.map((row, r) => (
        <Row key={r} style={{ marginBottom: r === rows.length - 1 ? 0 : '16px' }}>
          {row.map((image, c) => (
            <Column
              key={c}
              className={columns >= 3 ? 'm-col' : undefined}
              style={{
                width: `${Math.floor(100 / row.length)}%`,
                verticalAlign: 'top',
                padding: '0 6px',
              }}
            >
              <Img
                src={image.url}
                alt={image.alt}
                width={Math.floor(552 / row.length)}
                style={{ display: 'block', width: '100%', borderRadius: '10px' }}
              />
              {image.caption ? (
                <Text dir="auto" style={{ ...type[13], margin: '8px 0 0' }}>
                  {image.caption}
                </Text>
              ) : null}
            </Column>
          ))}
        </Row>
      ))}
    </>
  )
}

function Quote({ fields }: BlockProps) {
  const text = (fields.text as string | null | undefined)?.trim()
  if (!text) return null
  const attribution = fields.attribution as string | null | undefined
  return (
    <Section style={{ textAlign: 'center' }}>
      <Text
        dir="auto"
        style={{
          ...type[28],
          fontWeight: 500,
          margin: '0 auto',
          maxWidth: '460px',
          whiteSpace: 'pre-line',
        }}
      >
        “{text}”
      </Text>
      {attribution ? (
        <Text dir="auto" style={{ ...type[13], margin: '20px 0 0' }}>
          {attribution}
        </Text>
      ) : null}
    </Section>
  )
}

const COLUMN_WIDTHS: Record<string, string[]> = {
  oneThird: ['33%', '67%'],
  twoThirds: ['67%', '33%'],
}

function Columns({ fields, ...context }: BlockProps) {
  const count = Number(fields.columnCount ?? 2)
  const widths = (count === 2 && COLUMN_WIDTHS[String(fields.ratio)]) || null
  return (
    <Row>
      {['first', 'second', 'third', 'fourth'].slice(0, count).map((key, i) => (
        <Column
          key={key}
          className="m-col"
          style={{
            width: widths?.[i] ?? `${Math.floor(100 / count)}%`,
            verticalAlign: 'top',
            padding: '0 8px',
          }}
        >
          <RichBody data={fields[key]} {...context} />
        </Column>
      ))}
    </Row>
  )
}

/** Every block a body can draw itself. Anything else goes through the rich text converter. */
const BODY_BLOCKS: Record<string, (props: BlockProps) => ReactNode> = {
  columns: Columns,
  gallery: Gallery,
  newsletterImage: BodyImage,
  newsletterPicks: Picks,
  newsletterQuote: Quote,
}

const blockOf = (node: EmailNode) => {
  const Draw = node.type === 'block' ? BODY_BLOCKS[String(node.fields?.blockType)] : undefined
  return Draw ? { Draw, fields: node.fields as Record<string, unknown> } : null
}

/** A body in document order: runs of text between the blocks that draw themselves. */
function RichBody({ data, ...context }: BodyContext & { data: unknown }) {
  const root = (data as { root?: EmailNode } | null | undefined)?.root
  const parts: ReactNode[] = []
  let run: EmailNode[] = []
  const margin = () => ({ marginTop: parts.length ? '24px' : 0 })
  const flush = () => {
    if (!run.length) return
    const html = richHtml({ root: { ...root, children: run } }, context.references)
    run = []
    if (html.trim()) {
      parts.push(
        <div
          key={parts.length}
          style={{ ...type[16], ...margin() }}
          dangerouslySetInnerHTML={{ __html: html }}
        />,
      )
    }
  }
  for (const node of root?.children ?? []) {
    const block = blockOf(node)
    if (!block) {
      run.push(node)
      continue
    }
    flush()
    parts.push(
      <Section key={parts.length} style={margin()}>
        <block.Draw fields={block.fields} {...context} />
      </Section>,
    )
  }
  flush()
  return <>{parts}</>
}

export function NewsletterEmail({
  issue,
  settings,
  unsubscribe,
  editId,
}: {
  issue: Issue
  settings: EmailSettings
  unsubscribe: string
  /** The issue's id, in the admin's preview only: marks the fields for the visual editor. */
  editId?: number
}) {
  const pe = editableIn(editId !== undefined)
  const cover = urlOf(issue.cover_image as Media)
  const coverRich = richHtml(issue.cover_caption, issue.references).replace(
    /<p /g,
    '<p style="margin:0" ',
  )
  const coverCaption = coverRich ? null : textUnder(null, cover?.alt, issue.title)
  const month = monthOf(issue.issue_date)
  return (
    <EmailLayout
      settings={settings}
      preview={issue.preheader || issue.title}
      kicker={['Newsletter', month].filter(Boolean).join(' · ')}
      unsubscribe={unsubscribe}
    >
      <Section
        {...(editId !== undefined ? pe.scope({ collection: 'newsletters', id: editId }) : {})}
      >
        <Box>
          {cover ? (
            <>
              <Img
                className="m-img"
                src={cover.url}
                alt={cover.alt}
                width={552}
                style={{
                  display: 'block',
                  width: '100%',
                  borderRadius: '12px',
                  marginBottom: coverRich || coverCaption ? '8px' : '32px',
                }}
                {...pe('cover_image')}
              />
              {coverRich ? (
                <div
                  style={{ ...type[13], margin: '0 0 32px' }}
                  {...pe('cover_caption')}
                  dangerouslySetInnerHTML={{ __html: coverRich }}
                />
              ) : coverCaption ? (
                <Text dir="auto" style={{ ...type[13], margin: '0 0 32px' }}>
                  {coverCaption}
                </Text>
              ) : null}
            </>
          ) : null}
          <Heading as="h1" dir="auto" style={{ ...type[32], margin: '0 0 16px' }} {...pe('title')}>
            {issue.title}
          </Heading>
        </Box>
        <Section {...pe.container('sections')}>
          {(issue.sections ?? []).map((section, i) => {
            const path = `sections.${i}`
            return (
              <Section key={section.id ?? i} {...pe(path, { row: { id: section.id } })}>
                <Box>
                  <div {...pe(`${path}.body`)}>
                    <RichBody
                      data={section.body}
                      settings={settings}
                      references={issue.references}
                      title={issue.title}
                    />
                  </div>
                </Box>
              </Section>
            )
          })}
        </Section>
      </Section>
      {settings.signoff ? (
        <Text
          dir="auto"
          style={{ ...type[16], color: colors.fg, margin: '8px 24px 0', textAlign: 'center' }}
        >
          {settings.signoff}
        </Text>
      ) : null}
    </EmailLayout>
  )
}

/**
 * An issue as an email. `unsubscribe` is Resend's placeholder when sent, or a
 * plain link for previews and tests.
 */
export const newsletterMail = async (
  issue: Issue,
  settings: EmailSettings,
  options: { unsubscribe: string; editId?: number },
) => ({
  subject: issue.title,
  ...(await renderEmail(
    <NewsletterEmail
      issue={issue}
      settings={settings}
      unsubscribe={options.unsubscribe}
      editId={options.editId}
    />,
  )),
})

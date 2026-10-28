import { emailRichTextHTML } from './rich-text'
import type { RichTextReferences } from '@/lib/rich-text-references'
import { env } from '@/env'
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

export type Section = Row &
  (
    | {
        blockType: 'picks'
        heading?: string | null
        items?: Array<
          Row & Record<string, unknown> & { type?: string | null; note?: string | null }
        > | null
      }
    | { blockType: 'text'; body?: unknown }
    | {
        blockType: 'gallery'
        heading?: string | null
        columns?: '2' | '3' | null
        images?: Array<Row & { image?: Media; caption?: string | null }> | null
      }
    | { blockType: 'quote'; text?: string | null; attribution?: string | null }
  )

export type Issue = {
  references?: RichTextReferences
  title: string
  preheader?: string | null
  issue_date?: string | null
  cover_image?: unknown
  body?: unknown
  sections?: Section[] | null
}

const monthOf = (date?: string | null) =>
  date
    ? new Date(date).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Cairo',
      })
    : null

/**
 * Rich text as email HTML, each block reading in its own direction: an
 * Arabic paragraph runs right to left, an English one left to right.
 */
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

type SectionProps<K extends Section['blockType']> = {
  section: Extract<Section, { blockType: K }>
  pe: Editable
  /** The section's data path, e.g. `sections.0`. */
  path: string
}

function Picks({
  section,
  settings,
  pe,
  path,
}: SectionProps<'picks'> & { settings: EmailSettings }) {
  const t = settings.texts.newsletter
  const labels = { site: settings.site, read: t.read, apply: t.apply }
  // Each card keeps its place in the data, for the editor.
  const cards = (section.items ?? []).flatMap((p, at) => {
    const item = pickItemOf(p)
    const card = item ? cardOf(item, p.note, labels) : null
    return card ? [{ card, at, id: p.id }] : []
  })
  if (!cards.length && !pe.on) return null
  return (
    <Box>
      <Heading
        as="h2"
        dir="auto"
        style={{ ...type[28], margin: '0 0 32px' }}
        {...pe(`${path}.heading`)}
      >
        {section.heading || t.in_this_issue}
      </Heading>
      <Section
        {...pe.container(`${path}.items`)}
        style={cards.length ? undefined : { minHeight: '48px' }}
      >
        {cards.map(({ card, at, id }, i) => (
          <StackedCard
            key={`${card.url}${at}`}
            card={card}
            last={i === cards.length - 1}
            pe={pe}
            path={`${path}.items.${at}`}
            id={id}
          />
        ))}
      </Section>
    </Box>
  )
}

/** Images in a grid of two or three columns, each with its caption. */
function Gallery({ section, pe, path }: SectionProps<'gallery'>) {
  const columns = section.columns === '3' ? 3 : 2
  const images = (section.images ?? []).flatMap((i, at) => {
    const image = urlOf(i.image)
    return image ? [{ ...image, caption: i.caption?.trim() || null, at, id: i.id }] : []
  })
  if (!images.length && !pe.on) return null
  const rows: (typeof images)[] = []
  for (let i = 0; i < images.length; i += columns) rows.push(images.slice(i, i + columns))
  const width = `${Math.floor(100 / columns)}%`
  return (
    <Box>
      {section.heading ? (
        <Heading
          as="h2"
          dir="auto"
          style={{ ...type[28], margin: '0 0 28px' }}
          {...pe(`${path}.heading`)}
        >
          {section.heading}
        </Heading>
      ) : null}
      <Section
        {...pe.container(`${path}.images`)}
        style={images.length ? undefined : { minHeight: '48px' }}
      >
        {rows.map((row, r) => (
          <Row key={r} style={{ marginBottom: r === rows.length - 1 ? 0 : '16px' }}>
            {Array.from({ length: columns }, (_, c) => {
              const image = row[c]
              return (
                <Column
                  key={c}
                  className={columns === 3 ? 'm-col' : undefined}
                  style={{ width, verticalAlign: 'top', padding: '0 6px' }}
                  {...(image ? pe(`${path}.images.${image.at}`, { row: { id: image.id } }) : {})}
                >
                  {image ? (
                    <>
                      <Img
                        src={image.url}
                        alt={image.alt}
                        width={columns === 3 ? 172 : 264}
                        style={{ display: 'block', width: '100%', borderRadius: '10px' }}
                      />
                      {image.caption ? (
                        <Text
                          dir="auto"
                          style={{ ...type[13], margin: '8px 0 0' }}
                          {...pe(`${path}.images.${image.at}.caption`)}
                        >
                          {image.caption}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </Column>
              )
            })}
          </Row>
        ))}
      </Section>
    </Box>
  )
}

function Quote({ section, pe, path }: SectionProps<'quote'>) {
  if (!section.text?.trim()) return null
  return (
    <Box center>
      <Text
        dir="auto"
        style={{
          ...type[28],
          fontWeight: 500,
          margin: '0 auto',
          maxWidth: '460px',
          whiteSpace: 'pre-line',
        }}
        {...pe(`${path}.text`)}
      >
        “{section.text.trim()}”
      </Text>
      {section.attribution ? (
        <Text dir="auto" style={{ ...type[13], margin: '20px 0 0' }} {...pe(`${path}.attribution`)}>
          {section.attribution}
        </Text>
      ) : null}
    </Box>
  )
}

function TextSection({
  section,
  pe,
  path,
  references,
}: SectionProps<'text'> & { references?: RichTextReferences }) {
  const html = richHtml(section.body, references)
  return html ? (
    <Box>
      <div
        style={{ ...type[16] }}
        {...pe(`${path}.body`)}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  ) : null
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
  const intro = richHtml(issue.body, issue.references)
  const cover = urlOf(issue.cover_image as Media)
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
            <Img
              className="m-img"
              src={cover.url}
              alt={cover.alt}
              width={552}
              style={{
                display: 'block',
                width: '100%',
                borderRadius: '12px',
                marginBottom: '32px',
              }}
              {...pe('cover_image')}
            />
          ) : null}
          <Heading as="h1" dir="auto" style={{ ...type[32], margin: '0 0 16px' }} {...pe('title')}>
            {issue.title}
          </Heading>
          {intro ? (
            <div
              style={{ ...type[16] }}
              {...pe('body')}
              dangerouslySetInnerHTML={{ __html: intro }}
            />
          ) : null}
        </Box>
        <Section {...pe.container('sections')}>
          {(issue.sections ?? []).map((section, i) => {
            const path = `sections.${i}`
            const body = (() => {
              switch (section.blockType) {
                case 'picks':
                  return <Picks section={section} settings={settings} pe={pe} path={path} />
                case 'gallery':
                  return <Gallery section={section} pe={pe} path={path} />
                case 'quote':
                  return <Quote section={section} pe={pe} path={path} />
                case 'text':
                  return (
                    <TextSection
                      section={section}
                      pe={pe}
                      path={path}
                      references={issue.references}
                    />
                  )
                default:
                  return null
              }
            })()
            return (
              <Section
                key={section.id ?? i}
                {...pe(path, { row: { id: section.id, blockType: section.blockType } })}
              >
                {body}
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

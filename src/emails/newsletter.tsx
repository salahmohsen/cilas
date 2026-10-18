import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { Column, Heading, Img, Link, Row, Section, Text } from 'react-email'

import { cardOf, type Card, type PickRelation } from './cards'
import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import type { EmailSettings } from './settings'
import { colors, type } from './theme'

type PickItem = { relationTo: PickRelation; value: unknown }
type Media = { url?: string | null; alt?: string | null } | number | null | undefined

export type Section =
  | { blockType: 'picks'; heading?: string | null; items?: Array<{ item?: PickItem | null; note?: string | null }> | null }
  | { blockType: 'text'; body?: unknown }
  | {
      blockType: 'gallery'
      heading?: string | null
      columns?: '2' | '3' | null
      images?: Array<{ image?: Media; caption?: string | null }> | null
    }
  | { blockType: 'quote'; text?: string | null; attribution?: string | null }

export type Issue = {
  title: string
  preheader?: string | null
  issue_date?: string | null
  cover_image?: unknown
  body?: unknown
  sections?: Section[] | null
}

const monthOf = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }) : null

/**
 * Rich text as email HTML, each block reading in its own direction: an
 * Arabic paragraph runs right to left, an English one left to right.
 */
const richHtml = (data: unknown) =>
  data
    ? convertLexicalToHTML({ data: data as never }).replace(
        /<(p|h[1-6]|li|blockquote|ul|ol)(\s|>)/g,
        (_, tag: string, next: string) => `<${tag} dir="auto"${next}`,
      )
    : ''

const urlOf = (media: Media) => {
  const m = media as { url?: string | null; alt?: string | null } | null
  return m && typeof m === 'object' && m.url?.startsWith('http') ? { url: m.url, alt: m.alt ?? '' } : null
}

function CardText({ card, accent }: { card: Card; accent: string }) {
  return (
    <>
      <Text style={{ ...type[13], margin: '0 0 4px' }}>{[card.kind, card.meta].filter(Boolean).join(' · ')}</Text>
      <Text dir="auto" style={{ ...type[20], margin: '0 0 4px' }}>
        <Link href={card.url} style={{ color: colors.fg, textDecoration: 'none' }}>
          {card.title}
        </Link>
      </Text>
      {card.byline ? (
        <Text dir="auto" style={{ ...type[16], color: colors.fg, margin: '0 0 8px' }}>
          by {card.byline}
        </Text>
      ) : null}
      {card.text ? (
        <Text dir="auto" style={{ ...type[16], margin: '0 0 8px' }}>
          {card.text}
        </Text>
      ) : null}
      {card.list.length ? (
        <Text style={{ ...type[16], margin: '0 0 8px' }}>
          {card.list.map((c, i) => (
            <span key={c.url}>
              {i > 0 ? <br /> : null}
              {'· '}
              <Link href={c.url} dir="auto" style={{ color: colors.fg2, textDecoration: 'none' }}>
                {c.title}
              </Link>
            </span>
          ))}
        </Text>
      ) : null}
      {card.note ? (
        <Text dir="auto" style={{ ...type[16], color: colors.fg, margin: '0 0 8px' }}>
          {card.note}
        </Text>
      ) : null}
      <Link
        href={card.url}
        style={{ ...type[16], color: accent === '#000000' ? colors.fg : accent, textDecoration: 'underline' }}
      >
        {card.button} →
      </Link>
    </>
  )
}

/** A pick as a row: its image on one side, its words on the other, sides alternating. */
function CardRow({ card, flip, last, accent }: { card: Card; flip: boolean; last: boolean; accent: string }) {
  const bottom = last ? '0' : '36px'
  if (!card.image) {
    return (
      <Section style={{ marginBottom: bottom }}>
        <CardText card={card} accent={accent} />
      </Section>
    )
  }
  const image = (
    <Column
      key="image"
      className="m-col"
      style={{ width: '48%', verticalAlign: 'middle', [flip ? 'paddingLeft' : 'paddingRight']: '20px' }}
    >
      <Link href={card.url}>
        <Img
          className="m-img"
          src={card.image.url}
          alt={card.image.alt}
          width={260}
          style={{ display: 'block', width: '100%', maxWidth: '260px', borderRadius: '12px' }}
        />
      </Link>
    </Column>
  )
  const words = (
    <Column key="words" className="m-col" style={{ width: '52%', verticalAlign: 'middle' }}>
      <CardText card={card} accent={accent} />
    </Column>
  )
  return <Row style={{ marginBottom: bottom }}>{flip ? [words, image] : [image, words]}</Row>
}

function Picks({ section, settings }: { section: Extract<Section, { blockType: 'picks' }>; settings: EmailSettings }) {
  const t = settings.texts.newsletter
  const labels = { site: settings.site, read: t.read, apply: t.apply }
  const cards = (section.items ?? [])
    .map((p) => (p.item ? cardOf(p.item, p.note, labels) : null))
    .filter((c): c is Card => c !== null)
  if (!cards.length) return null
  return (
    <Box>
      <Heading as="h2" dir="auto" style={{ ...type[28], margin: '0 0 36px' }}>
        {section.heading || t.in_this_issue}
      </Heading>
      {cards.map((card, i) => (
        <CardRow key={card.url + i} card={card} flip={i % 2 === 1} last={i === cards.length - 1} accent={settings.accent} />
      ))}
    </Box>
  )
}

/** Images in a grid of two or three columns, each with its caption. */
function Gallery({ section }: { section: Extract<Section, { blockType: 'gallery' }> }) {
  const columns = section.columns === '3' ? 3 : 2
  const images = (section.images ?? []).flatMap((i) => {
    const image = urlOf(i.image)
    return image ? [{ ...image, caption: i.caption?.trim() || null }] : []
  })
  if (!images.length) return null
  const rows: (typeof images)[] = []
  for (let i = 0; i < images.length; i += columns) rows.push(images.slice(i, i + columns))
  const width = `${Math.floor(100 / columns)}%`
  return (
    <Box>
      {section.heading ? (
        <Heading as="h2" dir="auto" style={{ ...type[28], margin: '0 0 28px' }}>
          {section.heading}
        </Heading>
      ) : null}
      {rows.map((row, r) => (
        <Row key={r} style={{ marginBottom: r === rows.length - 1 ? 0 : '16px' }}>
          {Array.from({ length: columns }, (_, c) => {
            const image = row[c]
            return (
              <Column
                key={c}
                className={columns === 3 ? 'm-col' : undefined}
                style={{ width, verticalAlign: 'top', padding: '0 6px' }}
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
                      <Text dir="auto" style={{ ...type[13], margin: '8px 0 0' }}>
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
    </Box>
  )
}

function Quote({ section }: { section: Extract<Section, { blockType: 'quote' }> }) {
  if (!section.text?.trim()) return null
  return (
    <Box center>
      <Text dir="auto" style={{ ...type[28], fontWeight: 500, margin: '0 auto', maxWidth: '460px', whiteSpace: 'pre-line' }}>
        “{section.text.trim()}”
      </Text>
      {section.attribution ? (
        <Text dir="auto" style={{ ...type[13], margin: '20px 0 0' }}>
          {section.attribution}
        </Text>
      ) : null}
    </Box>
  )
}

function TextSection({ section }: { section: Extract<Section, { blockType: 'text' }> }) {
  const html = richHtml(section.body)
  return html ? (
    <Box>
      <div style={{ ...type[16] }} dangerouslySetInnerHTML={{ __html: html }} />
    </Box>
  ) : null
}

export function NewsletterEmail({
  issue,
  settings,
  unsubscribe,
}: {
  issue: Issue
  settings: EmailSettings
  unsubscribe: string
}) {
  const intro = richHtml(issue.body)
  const cover = urlOf(issue.cover_image as Media)
  const month = monthOf(issue.issue_date)
  return (
    <EmailLayout
      settings={settings}
      preview={issue.preheader || issue.title}
      kicker={['Newsletter', month].filter(Boolean).join(' · ')}
      unsubscribe={unsubscribe}
    >
      <Box>
        {cover ? (
          <Img
            className="m-img"
            src={cover.url}
            alt={cover.alt}
            width={552}
            style={{ display: 'block', width: '100%', borderRadius: '12px', marginBottom: '32px' }}
          />
        ) : null}
        <Heading as="h1" dir="auto" style={{ ...type[32], margin: '0 0 16px' }}>
          {issue.title}
        </Heading>
        {intro ? <div style={{ ...type[16] }} dangerouslySetInnerHTML={{ __html: intro }} /> : null}
      </Box>
      {(issue.sections ?? []).map((section, i) => {
        switch (section.blockType) {
          case 'picks':
            return <Picks key={i} section={section} settings={settings} />
          case 'gallery':
            return <Gallery key={i} section={section} />
          case 'quote':
            return <Quote key={i} section={section} />
          case 'text':
            return <TextSection key={i} section={section} />
          default:
            return null
        }
      })}
      {settings.signoff ? (
        <Text dir="auto" style={{ ...type[16], color: colors.fg, margin: '8px 24px 0', textAlign: 'center' }}>
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
export const newsletterMail = async (issue: Issue, settings: EmailSettings, options: { unsubscribe: string }) => ({
  subject: issue.title,
  ...(await renderEmail(<NewsletterEmail issue={issue} settings={settings} unsubscribe={options.unsubscribe} />)),
})

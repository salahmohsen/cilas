import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { Column, Heading, Img, Link, Row, Section, Text } from 'react-email'

import { cardOf, type Card, type PickRelation } from './cards'
import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import type { EmailSettings } from './settings'
import { editableIn, type Editable } from '@/lib/editable'
import { colors, type } from './theme'

type PickItem = { relationTo: PickRelation; value: unknown }
type Media = { url?: string | null; alt?: string | null } | number | null | undefined

type Row = { id?: string | null }

export type Section = Row &
  (
    | {
        blockType: 'picks'
        heading?: string | null
        items?: Array<Row & { item?: PickItem | null; note?: string | null }> | null
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
const richHtml = (data: unknown) =>
  data
    ? convertLexicalToHTML({ data: data as never }).replace(
        /<(p|h[1-6]|li|blockquote|ul|ol)(\s|>)/g,
        (_, tag: string, next: string) => `<${tag} dir="auto"${next}`,
      )
    : ''

const urlOf = (media: Media) => {
  const m = media as { url?: string | null; alt?: string | null } | null
  return m && typeof m === 'object' && m.url?.startsWith('http')
    ? { url: m.url, alt: m.alt ?? '' }
    : null
}

function CardText({
  card,
  accent,
  pe,
  path,
}: {
  card: Card
  accent: string
  pe: Editable
  path: string
}) {
  return (
    <>
      <Text style={{ ...type[13], margin: '0 0 4px' }}>
        {[card.kind, card.meta].filter(Boolean).join(' · ')}
      </Text>
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
        <Text
          dir="auto"
          style={{ ...type[16], color: colors.fg, margin: '0 0 8px' }}
          {...pe(`${path}.note`)}
        >
          {card.note}
        </Text>
      ) : null}
      <Link
        href={card.url}
        style={{
          ...type[16],
          color: accent === '#000000' ? colors.fg : accent,
          textDecoration: 'underline',
        }}
      >
        {card.button} →
      </Link>
    </>
  )
}

/** A pick as a row: its image on one side, its words on the other, sides alternating. */
function CardRow({
  card,
  flip,
  last,
  accent,
  pe,
  path,
  id,
}: {
  card: Card
  flip: boolean
  last: boolean
  accent: string
  pe: Editable
  /** The pick's data path, e.g. `sections.0.items.2`. */
  path: string
  id?: string | null
}) {
  const bottom = last ? '0' : '36px'
  const row = pe(path, { row: { id } })
  if (!card.image) {
    return (
      <Section style={{ marginBottom: bottom }} {...row}>
        <CardText card={card} accent={accent} pe={pe} path={path} />
      </Section>
    )
  }
  const image = (
    <Column
      key="image"
      className="m-col"
      style={{
        width: '48%',
        verticalAlign: 'middle',
        [flip ? 'paddingLeft' : 'paddingRight']: '20px',
      }}
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
      <CardText card={card} accent={accent} pe={pe} path={path} />
    </Column>
  )
  return (
    <Row style={{ marginBottom: bottom }} {...row}>
      {flip ? [words, image] : [image, words]}
    </Row>
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
    const card = p.item ? cardOf(p.item, p.note, labels) : null
    return card ? [{ card, at, id: p.id }] : []
  })
    if (!cards.length && !pe.on) return null
  return (
    <Box>
      <Heading
        as="h2"
        dir="auto"
        style={{ ...type[28], margin: '0 0 36px' }}
        {...pe(`${path}.heading`)}
      >
        {section.heading || t.in_this_issue}
      </Heading>
      <Section
        {...pe.container(`${path}.items`)}
        style={cards.length ? undefined : { minHeight: '48px' }}
      >
        {cards.map(({ card, at, id }, i) => (
          <CardRow
            key={card.url + at}
            card={card}
            flip={i % 2 === 1}
            last={i === cards.length - 1}
            accent={settings.accent}
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

function TextSection({ section, pe, path }: SectionProps<'text'>) {
  const html = richHtml(section.body)
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
                  return <TextSection section={section} pe={pe} path={path} />
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

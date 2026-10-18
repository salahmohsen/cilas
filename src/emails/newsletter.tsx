import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { Column, Heading, Img, Link, Row, Section, Text } from 'react-email'

import { cardOf, type Card } from './cards'
import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import type { EmailSettings } from './settings'
import { colors, type } from './theme'

type PickItem = { relationTo: 'courses' | 'articles' | 'programmes'; value: unknown }

export type Issue = {
  title: string
  preheader?: string | null
  issue_date?: string | null
  cover_image?: unknown
  body?: unknown
  picks?: Array<{ item?: PickItem | null; note?: string | null }> | null
}

const monthOf = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' }) : null

function CardText({ card, accent }: { card: Card; accent: string }) {
  return (
    <>
      <Text style={{ ...type[13], margin: '0 0 4px' }}>{[card.kind, card.meta].filter(Boolean).join(' · ')}</Text>
      <Text style={{ ...type[20], margin: '0 0 8px' }}>
        <Link href={card.url} style={{ color: colors.fg, textDecoration: 'none' }}>
          {card.title}
        </Link>
      </Text>
      {card.text ? <Text style={{ ...type[16], margin: '0 0 8px' }}>{card.text}</Text> : null}
      {card.note ? <Text style={{ ...type[16], color: colors.fg, margin: '0 0 8px' }}>{card.note}</Text> : null}
      <Link href={card.url} style={{ ...type[16], color: accent === '#000000' ? colors.fg : accent, textDecoration: 'underline' }}>
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
    <Column className="m-col" style={{ width: '48%', verticalAlign: 'middle', [flip ? 'paddingLeft' : 'paddingRight']: '20px' }}>
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
    <Column className="m-col" style={{ width: '52%', verticalAlign: 'middle' }}>
      <CardText card={card} accent={accent} />
    </Column>
  )
  return <Row style={{ marginBottom: bottom }}>{flip ? [words, image] : [image, words]}</Row>
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
  const t = settings.texts.newsletter
  const labels = { site: settings.site, read: t.read, apply: t.apply }
  const cards = (issue.picks ?? [])
    .map((p) => (p.item ? cardOf(p.item, p.note, labels) : null))
    .filter((c): c is Card => c !== null)
  const intro = issue.body ? convertLexicalToHTML({ data: issue.body as never }) : ''
  const cover = issue.cover_image as { url?: string | null; alt?: string | null } | null | undefined
  const month = monthOf(issue.issue_date)
  return (
    <EmailLayout
      settings={settings}
      preview={issue.preheader || issue.title}
      kicker={['Newsletter', month].filter(Boolean).join(' · ')}
      unsubscribe={unsubscribe}
    >
      <Box>
        {cover?.url?.startsWith('http') ? (
          <Img
            className="m-img"
            src={cover.url}
            alt={cover.alt ?? ''}
            width={552}
            style={{ display: 'block', width: '100%', borderRadius: '12px', marginBottom: '32px' }}
          />
        ) : null}
        <Heading as="h1" style={{ ...type[32], margin: '0 0 16px' }}>
          {issue.title}
        </Heading>
        {intro ? <div style={{ ...type[16] }} dangerouslySetInnerHTML={{ __html: intro }} /> : null}
      </Box>
      {cards.length ? (
        <Box>
          <Heading as="h2" style={{ ...type[28], margin: '0 0 36px' }}>
            {t.in_this_issue}
          </Heading>
          {cards.map((card, i) => (
            <CardRow key={card.url} card={card} flip={i % 2 === 1} last={i === cards.length - 1} accent={settings.accent} />
          ))}
        </Box>
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

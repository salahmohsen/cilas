import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { Button, Heading, Img, Link, Section, Text } from 'react-email'

import { cardOf, type Card } from './cards'
import { EmailLayout } from './layout'
import { renderEmail } from './render'
import type { EmailSettings } from './settings'
import { button as buttonStyle, colors, type } from './theme'

type PickItem = { relationTo: 'courses' | 'articles' | 'programmes'; value: unknown }

export type Issue = {
  title: string
  preheader?: string | null
  body?: unknown
  picks?: Array<{ item?: PickItem | null; note?: string | null }> | null
}

function CardBlock({ card, accent }: { card: Card; accent: string }) {
  return (
    <Section style={{ margin: '0 0 28px' }}>
      {card.image ? (
        <Link href={card.url}>
          <Img
            src={card.image.url}
            alt={card.image.alt}
            width={536}
            style={{ display: 'block', width: '100%', borderRadius: '6px' }}
          />
        </Link>
      ) : null}
      <Text style={{ ...type.small, margin: '12px 0 4px' }}>
        {[card.kind, card.meta].filter(Boolean).join(' · ')}
      </Text>
      <Text style={{ ...type.title, margin: '0 0 6px' }}>
        <Link href={card.url} style={{ color: colors.fg, textDecoration: 'none' }}>
          {card.title}
        </Link>
      </Text>
      {card.text ? <Text style={{ ...type.body, margin: '0 0 6px' }}>{card.text}</Text> : null}
      {card.note ? <Text style={{ ...type.body, margin: '0 0 6px', color: colors.fg }}>{card.note}</Text> : null}
      <Button href={card.url} style={{ ...buttonStyle(accent), marginTop: '6px' }}>
        {card.button}
      </Button>
    </Section>
  )
}

export function NewsletterEmail({
  issue,
  settings,
  site,
  unsubscribe,
}: {
  issue: Issue
  settings: EmailSettings
  site: string
  unsubscribe: string
}) {
  const labels = { site, read: settings.texts.newsletter.read, apply: settings.texts.newsletter.apply }
  const cards = (issue.picks ?? [])
    .map((p) => (p.item ? cardOf(p.item, p.note, labels) : null))
    .filter((c): c is Card => c !== null)
  const intro = issue.body ? convertLexicalToHTML({ data: issue.body as never }) : ''
  return (
    <EmailLayout settings={settings} preview={issue.preheader || issue.title} unsubscribe={unsubscribe}>
      <Heading as="h1" style={{ ...type.heading, margin: '8px 0 16px' }}>
        {issue.title}
      </Heading>
      {intro ? <div style={{ ...type.body, margin: '0 0 24px' }} dangerouslySetInnerHTML={{ __html: intro }} /> : null}
      {cards.map((card) => (
        <CardBlock key={card.url} card={card} accent={settings.accent} />
      ))}
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
  options: { site: string; unsubscribe: string },
) => ({
  subject: issue.title,
  ...(await renderEmail(<NewsletterEmail issue={issue} settings={settings} {...options} />)),
})

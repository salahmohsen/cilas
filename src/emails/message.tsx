import { Button, Section, Text } from 'react-email'

import { EmailLayout } from './layout'
import type { EmailSettings } from './settings'
import { button as buttonStyle, colors, type } from './theme'

/** A transactional email: paragraphs, an optional quoted note, an optional button. */
export function MessageEmail({
  settings,
  preview,
  paragraphs,
  note,
  button,
}: {
  settings: EmailSettings
  preview: string
  paragraphs: string[]
  note?: { label: string; text: string } | null
  button?: { label: string; url: string } | null
}) {
  return (
    <EmailLayout settings={settings} preview={preview}>
      {paragraphs.map((p, i) => (
        <Text key={i} style={{ ...type.body, margin: '0 0 16px', whiteSpace: 'pre-line' }}>
          {p}
        </Text>
      ))}
      {note ? (
        <Section style={{ borderLeft: `3px solid ${colors.stroke}`, padding: '4px 0 4px 16px', margin: '0 0 16px' }}>
          <Text style={{ ...type.small, margin: '0 0 4px' }}>{note.label}</Text>
          <Text style={{ ...type.body, margin: 0, whiteSpace: 'pre-line' }}>{note.text}</Text>
        </Section>
      ) : null}
      {button ? (
        <Section style={{ margin: '8px 0 0' }}>
          <Button href={button.url} style={buttonStyle(settings.accent)}>
            {button.label}
          </Button>
        </Section>
      ) : null}
    </EmailLayout>
  )
}

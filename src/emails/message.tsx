import { Button, Heading, Img, Section, Text } from 'react-email'

import { Box, EmailLayout } from './layout'
import type { EmailSettings } from './settings'
import { button as buttonStyle, colors, type } from './theme'

/**
 * A transactional email, after Barebone's password reset: one centred panel
 * with the sail, a heading, the paragraphs, an optional quoted note and an
 * optional button.
 */
export function MessageEmail({
  settings,
  preview,
  heading,
  kicker,
  paragraphs,
  note,
  button,
}: {
  settings: EmailSettings
  preview: string
  heading?: string
  kicker?: string
  paragraphs: string[]
  note?: { label: string; text: string } | null
  button?: { label: string; url: string } | null
}) {
  return (
    <EmailLayout settings={settings} preview={preview} kicker={kicker}>
      <Box center>
        <Section style={{ marginBottom: '12px' }}>
          <Img
            src={settings.logo.url}
            alt=""
            height={48}
            style={{ display: 'block', margin: '0 auto 20px' }}
          />
          {heading ? (
            <Heading as="h1" style={{ ...type[28], margin: 0 }}>
              {heading}
            </Heading>
          ) : null}
        </Section>
        {paragraphs.map((p, i) => (
          <Text
            key={i}
            style={{ ...type[16], margin: '0 auto 16px', maxWidth: '400px', textAlign: 'center', whiteSpace: 'pre-line' }}
          >
            {p}
          </Text>
        ))}
        {note ? (
          <Section
            style={{
              backgroundColor: colors.bg,
              borderRadius: '8px',
              padding: '16px 20px',
              margin: '8px auto 16px',
              maxWidth: '400px',
              textAlign: 'left',
            }}
          >
            <Text style={{ ...type[13], margin: '0 0 4px' }}>{note.label}</Text>
            <Text style={{ ...type[16], margin: 0, whiteSpace: 'pre-line' }}>{note.text}</Text>
          </Section>
        ) : null}
        {button ? (
          <Section style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button href={button.url} style={buttonStyle(settings.accent)}>
              {button.label}
            </Button>
          </Section>
        ) : null}
      </Box>
    </EmailLayout>
  )
}

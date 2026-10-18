import type { ReactNode } from 'react'
import { Body, Container, Font, Head, Hr, Html, Img, Link, Preview, Section, Text } from 'react-email'

import type { EmailSettings } from './settings'
import { colors, font, type } from './theme'

/**
 * The frame of every email: the logo, the content, and the footer. A
 * newsletter's footer also links to Resend's unsubscribe page.
 */
export function EmailLayout({
  settings,
  preview,
  unsubscribe,
  children,
}: {
  settings: EmailSettings
  /** The line mail apps show after the subject. */
  preview: string
  /** The unsubscribe link's target; leave out for transactional mail. */
  unsubscribe?: string
  children: ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily={['Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf',
            format: 'truetype',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg2, margin: 0, fontFamily: font }}>
        <Container style={{ maxWidth: '600px', margin: '32px auto', backgroundColor: colors.bg }}>
          <Section style={{ padding: '24px 32px 8px' }}>
            {settings.logo ? (
              <Img src={settings.logo.url} alt={settings.logo.alt} width={120} style={{ display: 'block' }} />
            ) : (
              <Text style={{ ...type.title, margin: 0 }}>CILAS</Text>
            )}
          </Section>
          <Section style={{ padding: '8px 32px 24px' }}>{children}</Section>
          <Hr style={{ borderColor: colors.stroke, margin: 0 }} />
          <Section style={{ padding: '16px 32px 24px' }}>
            {settings.footer.split('\n').map((line, i) => (
              <Text key={i} style={{ ...type.small, margin: 0 }}>
                {line}
              </Text>
            ))}
            {unsubscribe ? (
              <Text style={{ ...type.small, margin: '12px 0 0' }}>
                <Link href={unsubscribe} style={{ color: colors.fg3, textDecoration: 'underline' }}>
                  {settings.texts.newsletter.unsubscribe}
                </Link>
              </Text>
            ) : null}
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

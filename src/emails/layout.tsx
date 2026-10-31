import type { ReactNode } from 'react'
import {
  Body,
  Column,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from 'react-email'

import type { EmailSettings } from './settings'
import { colors, font, link, mobileCss, type } from './theme'

const INTER = 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVu'
const WEIGHTS = { 400: 'OKfMZg', 500: 'I6fMZg', 600: 'GKYMZg' } as const

/** A grey rounded panel: every block of an email's content sits in one. */
export function Box({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <Section
      className="m-box"
      style={{
        backgroundColor: colors.bg2,
        borderRadius: '10px',
        padding: '56px 44px',
        marginBottom: '24px',
        // No left alignment: each paragraph (dir="auto") aligns to its own start.
        ...(center ? { textAlign: 'center' as const } : {}),
      }}
    >
      {children}
    </Section>
  )
}

/**
 * The frame of every email, after Barebone: the sail and the institute's
 * name with a word on the right, the content in panels, then the tagline,
 * the social icons, the small print and, for newsletters, the unsubscribe line.
 */
export function EmailLayout({
  settings,
  preview,
  kicker,
  unsubscribe,
  children,
}: {
  settings: EmailSettings
  /** The line mail apps show after the subject. */
  preview: string
  /** A word or two at the top right, e.g. "Newsletter". */
  kicker?: string
  /** The unsubscribe link's target; leave out for transactional mail. */
  unsubscribe?: string
  children: ReactNode
}) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        {Object.entries(WEIGHTS).map(([weight, file]) => (
          <Font
            key={weight}
            fontFamily="Inter"
            fallbackFontFamily={['Arial', 'sans-serif']}
            webFont={{ url: `${INTER}${file}.ttf`, format: 'truetype' }}
            fontWeight={Number(weight)}
            fontStyle="normal"
          />
        ))}
        <style>{mobileCss}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: colors.bg2, margin: 0, fontFamily: font }}>
        <Container
          className="m-container"
          style={{ maxWidth: '640px', width: '100%', margin: '32px auto' }}
        >
          <Section className="m-frame" style={{ backgroundColor: colors.bg, padding: '16px 24px' }}>
            {/* Header */}
            <Section style={{ padding: '0 24px', marginBottom: '12px' }}>
              <Row>
                <Column style={{ width: '60%', verticalAlign: 'middle', padding: '7px 0' }}>
                  <Link href={settings.site} style={{ textDecoration: 'none' }}>
                    <Row>
                      <Column style={{ width: '30px', verticalAlign: 'middle' }}>
                        <Img
                          src={settings.logo.url}
                          alt={settings.logo.alt}
                          height={32}
                          style={{ display: 'block' }}
                        />
                      </Column>
                      <Column style={{ verticalAlign: 'middle', paddingLeft: '8px' }}>
                        <Text
                          style={{ ...type[13], color: colors.fg, margin: 0, lineHeight: '1.25' }}
                        >
                          Cairo Institute of
                          <br />
                          Liberal Arts and Sciences
                        </Text>
                      </Column>
                    </Row>
                  </Link>
                </Column>
                <Column
                  align="right"
                  style={{ width: '40%', verticalAlign: 'middle', padding: '7px 0' }}
                >
                  {kicker ? (
                    <Text
                      style={{ ...type[13], margin: 0, textAlign: 'right', whiteSpace: 'nowrap' }}
                    >
                      {kicker}
                    </Text>
                  ) : null}
                </Column>
              </Row>
            </Section>

            {children}

            {/* Footer */}
            <Section style={{ padding: '40px 24px', textAlign: 'center' }}>
              <Text
                style={{
                  ...type[13],
                  margin: '0 auto 32px',
                  maxWidth: '280px',
                  textAlign: 'center',
                }}
              >
                {settings.tagline}
              </Text>
              {settings.social.length ? (
                <Section style={{ marginBottom: '32px', textAlign: 'center' }}>
                  {settings.social.map((s) => (
                    <Link
                      key={s.url}
                      href={s.url}
                      style={{ display: 'inline-block', padding: '0 8px', verticalAlign: 'middle' }}
                    >
                      <Img
                        src={s.icon}
                        alt={s.platform}
                        width={18}
                        height={18}
                        style={{ display: 'block' }}
                      />
                    </Link>
                  ))}
                </Section>
              ) : null}
              <Text style={{ ...type[11], margin: '16px 0 20px', textAlign: 'center' }}>
                {settings.footer.split('\n').map((line, i) => (
                  <span key={i}>
                    {i > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
                <br />
                {settings.address.url ? (
                  <Link href={settings.address.url} style={{ ...link, color: colors.fg3 }}>
                    {settings.address.text}
                  </Link>
                ) : (
                  settings.address.text
                )}
              </Text>
              {unsubscribe ? (
                <Text style={{ ...type[11], margin: 0, textAlign: 'center' }}>
                  <Link
                    href={unsubscribe}
                    style={{ color: colors.fg3, textDecoration: 'underline' }}
                  >
                    {settings.texts.newsletter.unsubscribe}
                  </Link>{' '}
                  from CILAS emails.
                </Text>
              ) : null}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

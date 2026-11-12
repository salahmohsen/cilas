import { Button, Heading, Link, Section, Text } from 'react-email'

import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import { fill, type EmailSettings } from './settings'
import { button as buttonStyle, colors, type } from './theme'

export type Lang = 'en' | 'ar'

/** One line of a digest: the space it happened in, a clip of the text, a link. */
export type MailItem = { space: string; text: string; url: string }

type SpaceTexts = EmailSettings['texts']['spaces']

function Footer({
  t,
  unsubscribe,
  settingsUrl,
}: {
  t: SpaceTexts
  unsubscribe: string
  settingsUrl: string
}) {
  return (
    <Section style={{ textAlign: 'center', marginTop: '8px' }}>
      <Text style={{ ...type[13], margin: '0 0 8px' }}>{t.why}</Text>
      <Text style={{ ...type[13], margin: 0 }}>
        <Link href={settingsUrl} style={{ color: colors.fg3, textDecoration: 'underline' }}>
          {t.manage}
        </Link>{' '}
        <Link href={unsubscribe} style={{ color: colors.fg3, textDecoration: 'underline' }}>
          {t.stop}
        </Link>
      </Text>
    </Section>
  )
}

function ItemList({ title, items }: { title: string; items: MailItem[] }) {
  if (!items.length) return null
  return (
    <Section style={{ margin: '0 0 24px', textAlign: 'start' }}>
      <Heading as="h2" style={{ ...type[20], margin: '0 0 12px' }}>
        {title}
      </Heading>
      {items.map((item, i) => (
        <Section
          key={i}
          style={{
            backgroundColor: colors.bg,
            borderRadius: '8px',
            padding: '12px 16px',
            margin: '0 0 8px',
          }}
        >
          <Text style={{ ...type[13], margin: '0 0 2px' }}>{item.space}</Text>
          <Text dir="auto" style={{ ...type[16], margin: 0 }}>
            <Link href={item.url} style={{ color: colors.fg, textDecoration: 'underline' }}>
              {item.text}
            </Link>
          </Text>
        </Section>
      ))}
    </Section>
  )
}

export type DigestMailData = {
  mentions: MailItem[]
  replies: MailItem[]
  posts: MailItem[]
  /** Items past the lists above. */
  more: number
  spacesUrl: string
  settingsUrl: string
  unsubscribe: string
}

/** In the language of `settings`. */
export const digestMail = async (settings: EmailSettings, data: DigestMailData) => {
  const t = settings.texts.spaces
  const count = data.mentions.length + data.replies.length + data.posts.length + data.more
  const subject = fill(count === 1 ? t.digest_subject_one : t.digest_subject_other, {
    count: String(count),
  })
  const rendered = await renderEmail(
    <EmailLayout settings={settings} preview={subject} kicker={t.kicker} lang={settings.locale}>
      <Box>
        <Heading as="h1" style={{ ...type[28], margin: '0 0 24px', textAlign: 'center' }}>
          {t.digest_heading}
        </Heading>
        <ItemList title={t.mentions} items={data.mentions} />
        <ItemList title={t.replies} items={data.replies} />
        <ItemList title={t.posts} items={data.posts} />
        {data.more > 0 ? (
          <Text style={{ ...type[16], margin: '0 0 16px', textAlign: 'center' }}>
            {fill(t.more, { count: String(data.more) })}
          </Text>
        ) : null}
        <Section style={{ marginTop: '16px', textAlign: 'center' }}>
          <Button href={data.spacesUrl} style={buttonStyle(settings.accent)}>
            {t.digest_button}
          </Button>
        </Section>
      </Box>
      <Footer t={t} unsubscribe={data.unsubscribe} settingsUrl={data.settingsUrl} />
    </EmailLayout>,
  )
  return { subject, ...rendered }
}

export type AnnouncementMailData = {
  space: string
  /** A clip of the announcement, as plain text. */
  text: string
  url: string
  settingsUrl: string
  unsubscribe: string
}

/** In the language of `settings`. */
export const announcementMail = async (settings: EmailSettings, data: AnnouncementMailData) => {
  const t = settings.texts.spaces
  const subject = fill(t.announcement_subject, { space: data.space })
  const rendered = await renderEmail(
    <EmailLayout settings={settings} preview={subject} kicker={t.kicker} lang={settings.locale}>
      <Box>
        <Heading as="h1" style={{ ...type[28], margin: '0 0 24px', textAlign: 'center' }}>
          {fill(t.announcement_heading, { space: data.space })}
        </Heading>
        <Text dir="auto" style={{ ...type[16], margin: '0 0 24px', whiteSpace: 'pre-line' }}>
          {data.text}
        </Text>
        <Section style={{ textAlign: 'center' }}>
          <Button href={data.url} style={buttonStyle(settings.accent)}>
            {t.announcement_button}
          </Button>
        </Section>
      </Box>
      <Footer t={t} unsubscribe={data.unsubscribe} settingsUrl={data.settingsUrl} />
    </EmailLayout>,
  )
  return { subject, ...rendered }
}

import { Button, Heading, Link, Section, Text } from 'react-email'

import { Box, EmailLayout } from './layout'
import { renderEmail } from './render'
import type { EmailSettings } from './settings'
import { button as buttonStyle, colors, type } from './theme'

export type Lang = 'en' | 'ar'

/** One line of a digest: the space it happened in, a clip of the text, a link. */
export type MailItem = { space: string; text: string; url: string }

const STRINGS = {
  en: {
    kicker: 'Spaces',
    digestHeading: 'What happened in your spaces',
    digestSubject: (n: number) => `Your CILAS spaces: ${n} new ${n === 1 ? 'item' : 'items'}`,
    mentions: 'Mentions of you',
    replies: 'Replies to you',
    posts: 'New posts',
    more: (n: number) => `and ${n} more in your spaces`,
    open: 'Open my spaces',
    announcementHeading: (space: string) => `New announcement in ${space}`,
    announcementSubject: (space: string) => `Announcement in ${space}`,
    readAnnouncement: 'Read the announcement',
    stop: 'Stop all space email',
    manage: 'Change how often you get this in your settings.',
    why: 'You get this because you belong to a CILAS space.',
  },
  ar: {
    kicker: 'المساحات',
    digestHeading: 'ما جرى في مساحاتك',
    digestSubject: (n: number) => `مساحاتك في سيلاس: ${n} جديد`,
    mentions: 'إشارات إليك',
    replies: 'ردود عليك',
    posts: 'منشورات جديدة',
    more: (n: number) => `و${n} أخرى في مساحاتك`,
    open: 'افتح مساحاتي',
    announcementHeading: (space: string) => `إعلان جديد في ${space}`,
    announcementSubject: (space: string) => `إعلان في ${space}`,
    readAnnouncement: 'اقرأ الإعلان',
    stop: 'أوقف كل بريد المساحات',
    manage: 'غيّر عدد مرات وصول هذا البريد من إعداداتك.',
    why: 'يصلك هذا لأنك عضو في إحدى مساحات سيلاس.',
  },
} as const

export const subjectOf = {
  digest: (lang: Lang, n: number) => STRINGS[lang].digestSubject(n),
  announcement: (lang: Lang, space: string) => STRINGS[lang].announcementSubject(space),
}

function Footer({
  lang,
  unsubscribe,
  settingsUrl,
}: {
  lang: Lang
  unsubscribe: string
  settingsUrl: string
}) {
  const t = STRINGS[lang]
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
  lang: Lang
  mentions: MailItem[]
  replies: MailItem[]
  posts: MailItem[]
  /** Items past the lists above. */
  more: number
  spacesUrl: string
  settingsUrl: string
  unsubscribe: string
}

export const digestMail = async (settings: EmailSettings, data: DigestMailData) => {
  const t = STRINGS[data.lang]
  const subject = t.digestSubject(
    data.mentions.length + data.replies.length + data.posts.length + data.more,
  )
  const rendered = await renderEmail(
    <EmailLayout settings={settings} preview={subject} kicker={t.kicker} lang={data.lang}>
      <Box>
        <Heading as="h1" style={{ ...type[28], margin: '0 0 24px', textAlign: 'center' }}>
          {t.digestHeading}
        </Heading>
        <ItemList title={t.mentions} items={data.mentions} />
        <ItemList title={t.replies} items={data.replies} />
        <ItemList title={t.posts} items={data.posts} />
        {data.more > 0 ? (
          <Text style={{ ...type[16], margin: '0 0 16px', textAlign: 'center' }}>
            {t.more(data.more)}
          </Text>
        ) : null}
        <Section style={{ marginTop: '16px', textAlign: 'center' }}>
          <Button href={data.spacesUrl} style={buttonStyle(settings.accent)}>
            {t.open}
          </Button>
        </Section>
      </Box>
      <Footer lang={data.lang} unsubscribe={data.unsubscribe} settingsUrl={data.settingsUrl} />
    </EmailLayout>,
  )
  return { subject, ...rendered }
}

export type AnnouncementMailData = {
  lang: Lang
  space: string
  /** A clip of the announcement, as plain text. */
  text: string
  url: string
  settingsUrl: string
  unsubscribe: string
}

export const announcementMail = async (settings: EmailSettings, data: AnnouncementMailData) => {
  const t = STRINGS[data.lang]
  const subject = t.announcementSubject(data.space)
  const rendered = await renderEmail(
    <EmailLayout settings={settings} preview={subject} kicker={t.kicker} lang={data.lang}>
      <Box>
        <Heading as="h1" style={{ ...type[28], margin: '0 0 24px', textAlign: 'center' }}>
          {t.announcementHeading(data.space)}
        </Heading>
        <Text dir="auto" style={{ ...type[16], margin: '0 0 24px', whiteSpace: 'pre-line' }}>
          {data.text}
        </Text>
        <Section style={{ textAlign: 'center' }}>
          <Button href={data.url} style={buttonStyle(settings.accent)}>
            {t.readAnnouncement}
          </Button>
        </Section>
      </Box>
      <Footer lang={data.lang} unsubscribe={data.unsubscribe} settingsUrl={data.settingsUrl} />
    </EmailLayout>,
  )
  return { subject, ...rendered }
}

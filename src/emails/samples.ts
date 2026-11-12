import type { Payload } from 'payload'

import type { EmailId, VersionOf } from './catalog'
import { issueForEmail } from './issue'
import { newsletterMail } from './newsletter'
import type { EmailSettings } from './settings'
import { announcementMail, digestMail } from './space-mail'
import { INVITATION_DAYS } from '@/lib/invitation'

import {
  acceptanceMail,
  invitationMail,
  rejectionMail,
  resetMail,
  reviewMail,
} from './transactional'

type Mail = { subject: string; html: string; text: string }
/** `settings` are read in the language of the sample. */
type Context = { payload: Payload; settings: EmailSettings }
type Sample<K extends EmailId> = (context: Context, version: VersionOf<K>) => Promise<Mail | null>

const person = { name: 'Mona Adel', email: 'mona@example.com' }
const course = 'The Bridge Programme 2026'
const sampleLink = (settings: EmailSettings) => ({
  url: `${settings.site}/${settings.locale}/welcome/sample-token`,
  days: INVITATION_DAYS,
})

/**
 * Each email of the catalog with sample data, for the preview and the test
 * send in Email settings. The type asks for every email of the catalog.
 */
const SAMPLES: { [K in EmailId]: Sample<K> } = {
  acceptance: ({ settings }, version) =>
    acceptanceMail(settings, {
      ...person,
      title: course,
      setPassword: version === 'new_account' ? sampleLink(settings) : null,
      site: settings.site,
    }),
  invitation: ({ settings }) => invitationMail(settings, { ...person, ...sampleLink(settings) }),
  rejection: ({ settings }) => rejectionMail(settings, { ...person, title: course }),
  review: ({ settings }, version) =>
    reviewMail(
      settings,
      version,
      'On translation',
      version === 'changes_requested' || version === 'rejected'
        ? 'Please shorten the second part.'
        : null,
      { noun: 'article', url: `${settings.site}/admin` },
    ),
  reset: ({ settings }) =>
    resetMail(settings, { email: person.email, token: 'sample-token', site: settings.site }),
  spaces: ({ settings }, version) => {
    const { locale } = settings
    const links = {
      settingsUrl: `${settings.site}/${locale}/account`,
      unsubscribe: '#unsubscribe',
    }
    const space = locale === 'ar' ? 'ورشة الكتابة' : 'Writing workshop'
    const post = (text: string) => ({ space, text, url: `${settings.site}/${locale}/spaces` })
    return version === 'digest'
      ? digestMail(settings, {
          mentions: [
            post(
              locale === 'ar'
                ? 'منى، ما رأيك في هذا النص؟'
                : 'Mona, what do you think of this text?',
            ),
          ],
          replies: [post(locale === 'ar' ? 'شكرًا على الملاحظات.' : 'Thank you for the notes.')],
          posts: [post(locale === 'ar' ? 'قراءات الأسبوع القادم' : 'Readings for next week')],
          more: 2,
          spacesUrl: `${settings.site}/${locale}/spaces`,
          ...links,
        })
      : announcementMail(settings, {
          space,
          text:
            locale === 'ar'
              ? 'تبدأ جلسة الخميس في السادسة مساءً بدلًا من الخامسة.'
              : 'Thursday’s session starts at 6 pm instead of 5 pm.',
          url: `${settings.site}/${locale}/spaces`,
          ...links,
        })
  },
  newsletter: async ({ payload, settings }) => {
    const { docs } = await payload.find({
      collection: 'newsletters',
      sort: '-updatedAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
      select: {},
    })
    if (!docs[0]) return null
    return newsletterMail(await issueForEmail(payload, docs[0].id), settings, {
      unsubscribe: '#unsubscribe',
    })
  },
}

/** One email with sample data; null when there is nothing to show (no newsletter yet). */
export const sampleMail = <K extends EmailId>(id: K, version: VersionOf<K>, context: Context) =>
  (SAMPLES[id] as Sample<K>)(context, version)

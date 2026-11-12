import type { Locale } from '@/i18n/routing'

/**
 * Every email CILAS sends on its own, in one place. The Email settings
 * fields, their help, the preview and the test send all come from here, so a
 * new email is added once. Texts carry {placeholders} that `fill` replaces.
 * `texts.en` is the English default. A `localized` email goes out in its
 * reader's language and has Arabic defaults in `texts.ar`.
 */
type Texts_ = Record<string, string>

/** A localized email has Arabic defaults for every English one; others are English only. */
type CatalogEntry = {
  label: string
  when: string
  to: string
  placeholders: readonly string[]
  versions: Record<string, string>
} & (
  | { localized: true; texts: { en: Texts_; ar: Texts_ } }
  | { localized: false; texts: { en: Texts_ } }
)

export const EMAILS = {
  acceptance: {
    label: 'Application accepted',
    when: 'Sent when an admin accepts one course of an application.',
    to: 'The applicant, in the language they applied in.',
    localized: true,
    placeholders: ['name', 'email', 'title', 'days'],
    versions: { new_account: 'New account', existing_account: 'Existing account' },
    texts: {
      en: {
        subject: 'You are accepted to {title}',
        body: 'Dear {name},\n\nYou are accepted to {title}.',
        new_account:
          'We made a CILAS account for {email}. Use the button below to set your password. The link works for {days} days. If {email} is a Google address, you can also use “Continue with Google”.',
        new_account_button: 'Set your password',
        existing_account: 'Sign in with your CILAS account as usual.',
        button: 'Sign in',
      },
      ar: {
        subject: 'قُبلت في {title}',
        body: 'عزيزي/عزيزتي {name}،\n\nيسعدنا قبولك في {title}.',
        new_account:
          'أنشأنا لك حسابًا في سيلاس بالبريد {email}. اختر كلمة المرور من الزر أدناه. يعمل الرابط لمدة {days} أيام. إذا كان {email} حساب Google، يمكنك أيضًا استخدام «المتابعة باستخدام Google».',
        new_account_button: 'اختر كلمة المرور',
        existing_account: 'سجّل الدخول بحسابك في سيلاس كالمعتاد.',
        button: 'تسجيل الدخول',
      },
    },
  },
  invitation: {
    label: 'Invitation',
    when: 'Sent when an admin invites someone from Users, or sends them a new link.',
    to: 'The new account, in the language the admin chooses.',
    localized: true,
    placeholders: ['name', 'email', 'days'],
    versions: { invitation: 'Invitation' },
    texts: {
      en: {
        subject: 'Your CILAS account',
        body: 'Dear {name},\n\nWe made a CILAS account for you at {email}. To start, set your password with the button below. The link works for {days} days.',
        google: 'If {email} is a Google address, you can also use “Continue with Google”.',
        button: 'Set your password',
      },
      ar: {
        subject: 'حسابك في سيلاس',
        body: 'عزيزي/عزيزتي {name}،\n\nأنشأنا لك حسابًا في سيلاس بالبريد {email}. للبدء، اختر كلمة المرور من الزر أدناه. يعمل الرابط لمدة {days} أيام.',
        google: 'إذا كان {email} حساب Google، يمكنك أيضًا استخدام «المتابعة باستخدام Google».',
        button: 'اختر كلمة المرور',
      },
    },
  },
  rejection: {
    label: 'Application rejected',
    when: 'Sent when an admin rejects one course of an application.',
    to: 'The applicant, in the language they applied in.',
    localized: true,
    placeholders: ['name', 'email', 'title'],
    versions: { rejected: 'Rejected' },
    texts: {
      en: {
        subject: 'Your application to {title}',
        body: 'Dear {name},\n\nThank you for applying to {title}. We read every application with care. We are sorry that we cannot offer you a place this time.\n\nYou are welcome to apply to our future courses.',
      },
      ar: {
        subject: 'طلبك للالتحاق بـ{title}',
        body: 'عزيزي/عزيزتي {name}،\n\nشكرًا لتقديمك على {title}. نقرأ كل طلب بعناية. يؤسفنا أننا لا نستطيع أن نقدم لك مكانًا هذه المرة.\n\nنرحب بتقديمك على مقرراتنا القادمة.',
      },
    },
  },
  review: {
    label: 'Review status',
    when: 'Sent when an article, course or publication is submitted for review, and when an admin decides on it.',
    to: 'Admins when something is submitted; the owners when it is decided.',
    localized: false,
    placeholders: ['title'],
    versions: {
      submitted: 'Submitted',
      approved: 'Approved',
      changes_requested: 'Changes requested',
      rejected: 'Not accepted',
    },
    texts: {
      en: {
        submitted_subject: 'Submitted for review: {title}',
        submitted: '“{title}” was submitted for review.',
        approved_subject: 'Published: {title}',
        approved: '“{title}” was approved and is now published.',
        changes_requested_subject: 'Changes requested: {title}',
        changes_requested: '“{title}” needs changes before it can be published.',
        rejected_subject: 'Not accepted: {title}',
        rejected: '“{title}” was not accepted for publication.',
        note_label: 'Note from the editor',
      },
    },
  },
  reset: {
    label: 'Password reset',
    when: 'Sent when someone asks to reset a password.',
    to: 'The account’s email address.',
    localized: false,
    placeholders: ['email'],
    versions: { reset: 'Reset' },
    texts: {
      en: {
        subject: 'Reset your CILAS password',
        body: 'Someone asked to reset the password for {email}. To choose a new password, use the button below. If this was not you, ignore this email: your password stays the same.',
        button: 'Choose a new password',
      },
    },
  },
  spaces: {
    label: 'Space emails',
    when: 'The digest goes out daily or weekly, as each member chooses. The announcement goes out when someone posts an announcement.',
    to: 'Space members, in the language of their account.',
    localized: true,
    placeholders: ['count', 'space'],
    versions: { digest: 'Digest', announcement: 'Announcement' },
    texts: {
      en: {
        kicker: 'Spaces',
        digest_subject_one: 'Your CILAS spaces: {count} new item',
        digest_subject_other: 'Your CILAS spaces: {count} new items',
        digest_heading: 'What happened in your spaces',
        mentions: 'Mentions of you',
        replies: 'Replies to you',
        posts: 'New posts',
        more: 'and {count} more in your spaces',
        digest_button: 'Open my spaces',
        announcement_subject: 'Announcement in {space}',
        announcement_heading: 'New announcement in {space}',
        announcement_button: 'Read the announcement',
        why: 'You get this because you belong to a CILAS space.',
        manage: 'Change how often you get this in your settings.',
        stop: 'Stop all space email',
      },
      ar: {
        kicker: 'المساحات',
        digest_subject_one: 'مساحاتك في سيلاس: {count} جديد',
        digest_subject_other: 'مساحاتك في سيلاس: {count} جديد',
        digest_heading: 'ما جرى في مساحاتك',
        mentions: 'إشارات إليك',
        replies: 'ردود عليك',
        posts: 'منشورات جديدة',
        more: 'و{count} أخرى في مساحاتك',
        digest_button: 'افتح مساحاتي',
        announcement_subject: 'إعلان في {space}',
        announcement_heading: 'إعلان جديد في {space}',
        announcement_button: 'اقرأ الإعلان',
        why: 'يصلك هذا لأنك عضو في إحدى مساحات سيلاس.',
        manage: 'غيّر عدد مرات وصول هذا البريد من إعداداتك.',
        stop: 'أوقف كل بريد المساحات',
      },
    },
  },
  newsletter: {
    label: 'Newsletter',
    when: 'The button and link labels of each newsletter issue.',
    to: 'Newsletter subscribers.',
    localized: false,
    placeholders: [],
    versions: { latest: 'Latest issue' },
    texts: {
      en: {
        in_this_issue: 'In this issue',
        read: 'Read more',
        apply: 'Apply',
        unsubscribe: 'Unsubscribe',
      },
    },
  },
} as const satisfies Record<string, CatalogEntry>

export type EmailId = keyof typeof EMAILS
export type VersionOf<K extends EmailId> = keyof (typeof EMAILS)[K]['versions'] & string

/** Every email's texts, filled in: what the email builders read. */
export type Texts = {
  [K in EmailId]: { [F in keyof (typeof EMAILS)[K]['texts']['en']]: string }
}

export const EMAIL_IDS = Object.keys(EMAILS) as EmailId[]

/** The default texts of one email in one language: the Arabic ones where they exist. */
export const defaultTexts = (id: EmailId, locale: Locale): Record<string, string> => {
  const texts = EMAILS[id].texts as { en: Record<string, string>; ar?: Record<string, string> }
  return (locale === 'ar' && texts.ar) || texts.en
}

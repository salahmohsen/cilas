/**
 * The privacy notice members accept before their first post (spec §9).
 * Bump NOTICE_VERSION when a lawyer's check changes the text; acceptance
 * rows keep the version, so old consents never silently cover new text.
 */
export const NOTICE_VERSION = 1

export type NoticePart = { title: string; text: string }

export const NOTICE: Record<'en' | 'ar', NoticePart[]> = {
  en: [
    {
      title: 'What spaces store',
      text: 'Your posts, comments, reactions and files, with your name and photo.',
    },
    {
      title: 'Who sees them',
      text: 'The members of each space you write in, and the fellow moderating it.',
    },
    {
      title: 'How long',
      text: 'Deleted content is restorable for 30 days, then purged.',
    },
    {
      title: 'Your name and photo',
      text: 'They stay visible until you change your profile.',
    },
  ],
  ar: [
    { title: 'ما تحفظه المساحات', text: 'منشوراتك وتعليقاتك وتفاعلاتك وملفاتك، مع اسمك وصورتك.' },
    { title: 'من يراها', text: 'أعضاء كل مساحة تكتب فيها، والأستاذ المشرف عليها.' },
    { title: 'المدة', text: 'المحتوى المحذوف يُستعاد خلال ٣٠ يومًا، ثم يُحذف نهائيًا.' },
    { title: 'اسمك وصورتك', text: 'يبقيان ظاهرين حتى تغيّر ملفك الشخصي.' },
  ],
}

export const RULES_MAX = 3000

export const rulesText = (parts: NoticePart[]): string =>
  parts.map((p) => `${p.title}\n${p.text}`).join('\n\n')

/**
 * Edited "Privacy and rules" text read back into parts: each paragraph is a
 * part, its first line the title and the rest the answer. A one-line
 * paragraph is an answer with no title.
 */
export const rulesParts = (text: string): NoticePart[] =>
  text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [first = '', ...rest] = block.split('\n')
      return rest.length
        ? { title: first.trim(), text: rest.join(' ').replace(/\s+/g, ' ').trim() }
        : { title: '', text: first.trim() }
    })

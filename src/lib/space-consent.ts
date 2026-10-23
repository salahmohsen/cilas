/**
 * The privacy notice members accept before their first post (spec §9).
 * Bump NOTICE_VERSION when a lawyer's check changes the text; acceptance
 * rows keep the version, so old consents never silently cover new text.
 */
export const NOTICE_VERSION = 1

export const NOTICE: Record<'en' | 'ar', string> = {
  en:
    'What spaces store: your posts, comments, reactions and files, with your name ' +
    'and photo. Who sees them: the members of each space you write in, and the ' +
    'fellow moderating it. How long: deleted content is restorable for 30 days, ' +
    'then purged. Your name and photo stay visible until you change your profile.',
  ar:
    'ما تحفظه المساحات: منشوراتك وتعليقاتك وتفاعلاتك وملفاتك، مع اسمك وصورتك. ' +
    'من يراها: أعضاء كل مساحة تكتب فيها، والأستاذ المشرف عليها. المدة: المحتوى ' +
    'المحذوف يُستعاد خلال ٣٠ يومًا، ثم يُحذف نهائيًا. يبقى اسمك وصورتك ظاهرين حتى ' +
    'تغيّر ملفك الشخصي.',
}

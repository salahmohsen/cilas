export type IntroText = { title?: string | null; body?: string | null }

/** Used when the dashboard leaves a field empty; the dashboard shows each as the placeholder. */
export const INTRO_DEFAULTS: Record<'en' | 'ar', { title: string; body: string }> = {
  en: {
    title: 'Introduce yourself',
    body: 'Welcome. Tell the group who you are, and what question brings you here. Write it as a comment on this post. The other posts in this space open after your comment.',
  },
  ar: {
    title: 'عرّف بنفسك',
    body: 'أهلًا بك. عرّف المجموعة بنفسك: من أنت، وما السؤال الذي جاء بك إلى هنا. اكتب ذلك تعليقًا على هذا المنشور. تُفتح بقية المنشورات في هذه المساحة بعد تعليقك.',
  },
}

const part = (text: IntroText | null | undefined, lang: 'en' | 'ar') => {
  const title = text?.title?.trim() || INTRO_DEFAULTS[lang].title
  const body = text?.body?.trim() || INTRO_DEFAULTS[lang].body
  return `## ${title}\n\n${body}`
}

/**
 * The intro post's body, copied from the template when the space is made:
 * a post has one body, so both languages go in, English first.
 */
export const introBody = (en: IntroText | null | undefined, ar: IntroText | null | undefined) =>
  `${part(en, 'en')}\n\n---\n\n${part(ar, 'ar')}`

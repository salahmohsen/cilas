import type { Payload } from 'payload'

export const siteSettingsData = {
  contact_emails: { admissions: 'admissions@ci-las.org', info: 'info@ci-las.org' },
  social_links: [
    { platform: 'facebook' as const, url: 'https://www.facebook.com/cilasian' },
    { platform: 'x' as const, url: 'https://twitter.com/CILASian' },
    {
      platform: 'youtube' as const,
      url: 'http://www.youtube.com/channel/UCPDXrYj4ok4oslkuGROHsxA',
    },
  ],
}

/** The home page's questions, in both languages, in order. */
export const faqData: Array<Record<'en' | 'ar', { question: string; answer: string }>> = [
  {
    en: {
      question: 'What is CILAS?',
      answer:
        'An independent school in Cairo, founded in 2013. It runs cycles of courses each season and the Bridge, a year-long programme in the liberal arts, and publishes the work of its community.',
    },
    ar: {
      question: 'ما سيلاس؟',
      answer:
        'مدرسة مستقلة في القاهرة تأسست عام ٢٠١٣. تقدّم دورات من المقررات كل موسم، وبرنامج الجسر، وهو برنامج في الآداب والعلوم الحرة يمتد عامًا كاملًا، وتنشر أعمال مجتمعها.',
    },
  },
  {
    en: {
      question: 'Who can apply?',
      answer:
        'Anyone who has finished high school. For the Bridge, a bachelor’s degree is recommended but not required. Single courses are open to everyone.',
    },
    ar: {
      question: 'من يمكنه التقدم؟',
      answer:
        'كل من أنهى الدراسة الثانوية. يُستحسن الحصول على شهادة جامعية للالتحاق ببرنامج الجسر لكنها ليست شرطًا. والمقررات المنفردة مفتوحة للجميع.',
    },
  },
  {
    en: {
      question: 'Do I need to take the whole Bridge year?',
      answer:
        'No. Most courses in a cycle can be taken one at a time, without joining a programme.',
    },
    ar: {
      question: 'هل عليّ الالتحاق بعام الجسر كاملًا؟',
      answer: 'لا. يمكن أخذ معظم مقررات الدورة مقررًا مقررًا، دون الالتحاق ببرنامج.',
    },
  },
  {
    en: {
      question: 'My English isn’t perfect. Can I still join?',
      answer:
        'Yes. CILAS welcomes every kind of English and many discussions move between Arabic and English. Application forms are filled in English, as are many of the readings.',
    },
    ar: {
      question: 'لغتي الإنجليزية ليست مثالية. هل يمكنني الانضمام؟',
      answer:
        'نعم. يرحّب سيلاس بكل أشكال الإنجليزية، وتتنقل نقاشات كثيرة بين العربية والإنجليزية. تُملأ استمارات التقديم بالإنجليزية، وكذلك كثير من القراءات.',
    },
  },
  {
    en: {
      question: 'Are there scholarships?',
      answer:
        'Yes, partial scholarships for a limited number of students, based on need. Each programme’s page explains how to ask for one.',
    },
    ar: {
      question: 'هل توجد منح؟',
      answer: 'نعم، منح جزئية لعدد محدود من الطلاب بحسب الحاجة. تشرح صفحة كل برنامج كيف تطلبها.',
    },
  },
  {
    en: {
      question: 'Where are classes held?',
      answer: 'In Darb el-Labbana, in Cairo. Some courses also meet online.',
    },
    ar: {
      question: 'أين تُعقد الصفوف؟',
      answer: 'في درب اللبانة بالقاهرة. وتلتقي بعض المقررات عبر الإنترنت.',
    },
  },
]

/**
 * Globals have no create — `updateGlobal` is idempotent by nature. The FAQ
 * rows are shared by both locales: English writes them, Arabic fills the
 * same rows by id.
 */
export const seedSiteSettings = async (payload: Payload): Promise<void> => {
  const en = await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'en',
    data: { ...siteSettingsData, faq: faqData.map((f) => f.en) },
    overrideAccess: true,
  })
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: 'ar',
    data: { faq: faqData.map((f, i) => ({ id: en.faq?.[i]?.id, ...f.ar })) },
    overrideAccess: true,
  })
  console.log('site-settings updated')
}

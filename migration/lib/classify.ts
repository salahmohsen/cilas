export const PAGE_KINDS = [
  'cycle',
  'course',
  'lab',
  'people',
  'space',
  'programme',
  'publication',
  'press',
  'blog',
  'info',
] as const
export type PageKind = (typeof PAGE_KINDS)[number]

/** A page's path on the old site. Weebly served the home page at `/`. */
export const legacyUrlOf = (file: string): string => (file === 'index.html' ? '/' : `/${file}`)

// First match wins. Cycle pages come before labs, because a cycle's labs
// page ("spring-labs-2023") is still a cycle.
const RULES: Array<[RegExp, PageKind]> = [
  [/^-latest/, 'blog'],
  [/^(cilasians-|people\.|advisors\.|trustees\.)/, 'people'],
  [/(-space-in-|^al-manshiya|^space\.)/, 'space'],
  [/^(on-pigeon-towers|translation-as-education)\./, 'publication'],
  [/^press\./, 'press'],
  [
    /(cycle|semester|trimester|^(fall|spring|summer|winter)(-labs)?-\d{4}|^\d{4}-\d{4}|^cilas-in-alex-\d{4}|^82032024|^winter-cycle)/,
    'cycle',
  ],
  [/(^|-)labs?(-|\.)/, 'lab'],
  [
    /^(bridge-programme|programme|core-curriculum|curriculum|thematic-course|non-degree|offlineonline-course-cycles)/,
    'programme',
  ],
  [
    /^(index|about1|admissions|faqs|tuition|mission|core-values|support-us|scholarship|welcome-note|at-a-glance|learning-method|method|fellowship|becoming-a-fellow|open-call|collaboration|an-invitation|files|apps|pictures|cilas-channel|media\.|news-and-events|events-documents|projects|uwc-letter|community-service)/,
    'info',
  ],
]

/**
 * What a page holds. A hand override wins; then the first matching rule;
 * free-form names left over are 2013–2018 course pages.
 */
export const classifyPage = (file: string, overrides: Record<string, PageKind>): PageKind =>
  overrides[file] ?? RULES.find(([pattern]) => pattern.test(file))?.[1] ?? 'course'

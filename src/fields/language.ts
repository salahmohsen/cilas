/** Languages a piece of content or coverage is written in. */
export const LANGUAGE_OPTIONS = [
  { label: 'Arabic', value: 'ar' },
  { label: 'English', value: 'en' },
  { label: 'German', value: 'de' },
  { label: 'French', value: 'fr' },
  { label: 'Other', value: 'other' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

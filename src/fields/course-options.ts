/** Where a course meets. Shared by the course field and the AI access guides. */
export const LOCATION_OPTIONS = [
  { label: 'Offline', value: 'OFFLINE' },
  { label: 'Online', value: 'ONLINE' },
  { label: 'Hybrid', value: 'HYBRID' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

/** The languages a course is taught in. */
export const TEACHING_LANGUAGE_OPTIONS = [
  { label: 'Arabic', value: 'ar' },
  { label: 'English', value: 'en' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

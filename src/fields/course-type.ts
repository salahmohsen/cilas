/** Core, Thematic and Lab count toward the Bridge; Workshop and Short do not. */
export const COURSE_TYPE_OPTIONS = [
  { label: 'Core Course', value: 'CORE' },
  { label: 'Thematic Course', value: 'THEMATIC' },
  { label: 'Lab', value: 'LAB' },
  { label: 'Workshop', value: 'WORKSHOP' },
  { label: 'Short Course', value: 'SHORT' },
] as const satisfies ReadonlyArray<{ label: string; value: string }>

export type CourseType = (typeof COURSE_TYPE_OPTIONS)[number]['value']

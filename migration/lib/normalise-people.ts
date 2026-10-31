import type { ExtractedPerson } from './people-schema'

/** Bridge years the archive has course pages for but no cohort page (decided in the grilling, Q12). */
export const UNVERIFIED_YEARS = ['2020-2021', '2023-2024', '2024-2025']

/** "Bridge Programme 2015–2016", with "(Alexandria)" for the Alexandria cohorts. */
export const programmeTitle = (year: string, place: 'cairo' | 'alexandria'): string =>
  `Bridge Programme ${year.replace('-', '–')}${place === 'alexandria' ? ' (Alexandria)' : ''}`

type MembershipRole = 'student' | 'residential_fellow' | 'visiting_fellow'

/**
 * The membership role for a section group. A plain "Fellows" section is read
 * as residential fellows and flagged. Team, advisors and trustees get none.
 */
export const membershipRole = (
  group: ExtractedPerson['group'],
): { role: MembershipRole; flagged: boolean } | null => {
  switch (group) {
    case 'student':
      return { role: 'student', flagged: false }
    case 'residential_fellow':
      return { role: 'residential_fellow', flagged: false }
    case 'visiting_fellow':
      return { role: 'visiting_fellow', flagged: false }
    case 'fellow':
      return { role: 'residential_fellow', flagged: true }
    default:
      return null
  }
}

/**
 * Extracted bios often begin right after the bolded name ("is the … Professor").
 * When the first paragraph starts with a lowercase Latin letter, put the name back.
 */
export const completeBio = (name: string, bio: string): string =>
  /^[a-z]/.test(bio.trimStart()) ? `${name} ${bio.trimStart()}` : bio

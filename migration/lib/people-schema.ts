import * as z from 'zod'

export const PEOPLE_PROMPT_VERSION = '1'

export const ExtractedPerson = z.object({
  name: z.string().min(1),
  name_ar: z.string().nullable(),
  group: z.enum(['student', 'residential_fellow', 'visiting_fellow', 'fellow', 'team', 'advisor', 'trustee']),
  title: z.string().nullable(),
  bio: z.string(),
  email: z.string().nullable(),
  photo: z.string().nullable(),
  board_role: z.string().nullable(),
  advises_on: z.string().nullable(),
})
export type ExtractedPerson = z.infer<typeof ExtractedPerson>

export const PeoplePage = z.object({
  year: z.string().regex(/^\d{4}-\d{4}$/).nullable(),
  place: z.enum(['cairo', 'alexandria']).nullable(),
  people: z.array(ExtractedPerson),
})
export type PeoplePage = z.infer<typeof PeoplePage>

export const peoplePrompt = ({ file, title, text }: { file: string; title: string; text: string }): string => `You are extracting people from one archived page of CILAS, the Cairo Institute for Liberal Arts and Sciences. The page lists a year's community (students, fellows, team) or its board (advisors, trustees). Pages are in English, Arabic or both.

Page file: ${file}
Page title: ${title}

Rules:
- Use only facts stated on the page; null when absent. Never guess emails or names.
- year: the academic year the page covers, as "YYYY-YYYY" (e.g. "2015-2016"); null for advisors/trustees pages.
- place: "alexandria" if the page is about CILAS in Alexandria, "cairo" for Cairo cohorts; null for advisors/trustees pages.
- One entry per person, in page order. name: as written in English (fix only spacing; keep capitalisation of particles as written, but write the surname in normal case, e.g. "Michael BRINT" → "Michael Brint"). name_ar: their Arabic name if the page gives it.
- group from the section heading the person is under: "Students" → student; "Residential Fellows" → residential_fellow; "Visiting Fellows" → visiting_fellow; a plain "Fellows" or "Core Courses Fellows" → fellow; team, staff, coordinators, administration → team; advisors page → advisor; trustees page → trustee.
- title: their role or position as stated, e.g. "Teaching Fellow in the Humanities and Arts", "coordinates the field of Social Sciences", "Associate Professor of Political Philosophy, University College Maastricht"; null if none.
- bio: their text, verbatim; if given in both Arabic and English, both, each in its own paragraphs; paragraphs separated by a blank line.
- email: only from the page (mailto links). photo: the uploads/… path of the image directly before their name, as written; null if none.
- board_role (trustees only): e.g. "Chairman", "Treasurer". advises_on (advisors only): what they advise on, e.g. "curriculum design and university partnerships in the US and the UK".

Page text (links as [text](href), images as ![image](src), headings as ##):
"""
${text}
"""`

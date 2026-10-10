import * as z from 'zod'

/** Bump when the prompt or schema changes, so cached extractions re-run. */
export const PROMPT_VERSION = '2'

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()

export const ExtractedCourse = z.object({
  title: z.string().min(1),
  title_ar: z.string().nullable(),
  subtitle: z.string().nullable(),
  course_type: z.enum(['CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT']),
  fellows: z.array(
    z.object({ name: z.string().min(1), email: z.string().nullable(), bio: z.string().nullable() }),
  ),
  schedule_text: z.string().nullable(),
  weekdays: z.array(z.enum(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'])),
  start_time: time,
  end_time: time,
  weeks: z.number().int().positive().nullable(),
  start_date: day,
  location: z.array(z.enum(['OFFLINE', 'ONLINE', 'HYBRID'])),
  description: z.string(),
  flow_links: z.array(z.string()),
  register_url: z.string().nullable(),
  /** The course's own page, e.g. a "continue reading" link, as given in the text. */
  own_page: z.string().nullable(),
})
export type ExtractedCourse = z.infer<typeof ExtractedCourse>

export const ExtractedCycle = z.object({
  label: z.string(),
  season: z.enum(['fall', 'winter', 'spring', 'summer']).nullable(),
  start_year: z.number().int().min(2012).max(2100).nullable(),
  start_date: day,
  deadline: day,
  space_hint: z.enum(['darb el-labbana', 'al-ghuria', 'al-manshiya', 'online']).nullable(),
  courses: z.array(ExtractedCourse),
})
export type ExtractedCycle = z.infer<typeof ExtractedCycle>

/** A cycle page yields cycles; a course page yields one course. */
export const CoursePage = z.object({
  cycles: z.array(ExtractedCycle),
  course: ExtractedCourse.nullable(),
})
export type CoursePage = z.infer<typeof CoursePage>

/** Instructions for the extractor. Facts only from the page; null when absent. */
export const coursePrompt = ({
  file,
  kind,
  title,
  text,
}: {
  file: string
  kind: string
  title: string
  text: string
}): string => `You are extracting structured data from one archived page of CILAS, the Cairo Institute for Liberal Arts and Sciences (2013–2026). Pages are in English, Arabic or both.

Page file: ${file}
Page kind: ${kind} (cycle = an intake listing several courses; course or lab = one course's own page)
Page title: ${title}

Rules:
- Use only facts stated on the page. Use null or [] when something is not stated. Never guess emails, dates or times.
- A "cycle" is one intake: a season (fall, winter, spring, summer) and start year. Trimesters map: first → fall, second → winter, third → spring. A page may describe several cycles (e.g. a whole academic year); return each separately with its own courses.
- For a course or lab page, return its one course in "course" and leave "cycles" empty.
- course_type: CORE for core-curriculum courses; LAB for labs; WORKSHOP for workshops; THEMATIC for thematic or semester courses; SHORT for stand-alone short courses in offline/online cycles.
- Times are 24-hour "HH:MM" in Cairo time ("5:30-8 pm" → 17:30 and 20:00). Weekdays as sat, sun, mon, tue, wed, thu, fri. Dates as YYYY-MM-DD.
- location: OFFLINE (in person), ONLINE, HYBRID; several if the course mixes them.
- description: the course's own description, copied verbatim (keep the original language), paragraphs separated by a blank line. Exclude fellow bios, schedules and registration text.
- fellows: who teaches or coordinates the course, with their bio text and email if the page gives them. Use the person's full name if it appears anywhere on the page (heading, bio, signature, image caption); otherwise the name exactly as written. Never invent a surname.
- If only a start time is given, leave end_time null; never assume a duration.
- flow_links: links to the course's flow, syllabus or outline document (uploads/… paths), as written.
- own_page: the link to the course's own page (often "continue reading"), as written; null if none.
- space_hint: the venue if named: "darb el-labbana", "al-ghuria", "al-manshiya" (Alexandria), or "online" if the whole cycle is online.

Page text (links as [text](href), images as ![image](src), headings as ##):
"""
${text}
"""

Call the record_page tool with the result.`

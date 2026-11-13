import { FIELD_REGISTRY } from './field-registry'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import {
  LOCATION_OPTIONS,
  SESSION_UNIT_OPTIONS,
  TEACHING_LANGUAGE_OPTIONS,
} from '@/fields/course-options'
import { LANGUAGE_OPTIONS } from '@/fields/language'

import { CHOICE_QUESTION_TYPES, TEXT_QUESTION_TYPES } from './form-questions'

const list = (options: ReadonlyArray<{ label: string; value: string }>) =>
  options.map((o) => `- \`${o.value}\`: ${o.label}`).join('\n')

export const GUIDE_URIS = {
  course: 'cilas://guides/course',
  article: 'cilas://guides/article',
  form: 'cilas://guides/form',
} as const

const contract = (collection: 'courses' | 'articles') => {
  const entry = FIELD_REGISTRY[collection]
  return `Accepted field paths (all nested shapes and allowed values are in the tool schema):\n${entry.accepted.map((path) => `- \`${path}\``).join('\n')}\n\nExcluded:\n${Object.entries(
    entry.excluded,
  )
    .map(([path, reason]) => `- \`${path}\`: ${reason}`)
    .join('\n')}`
}
const writingRules = `Extract every source field before calling a tool. Never put schedule, dates, prices or fellows in description text. Find all relationship ids with lookup; media lookup returns existing media ids. Do not invent ids. Report conflicts and ask the person before saving. Use update tools to correct an existing draft instead of creating a duplicate. Omitted fields stay unchanged; explicit null clears an optional field; arrays replace the whole field (keep row ids to retain other-language text). Localized leaves use { en?, ar? }; rich text leaves take Markdown. Do not translate without permission. Include any unmappable source facts in source_unmapped: [{ field, reason }]. State every not_saved and needs_human_review result; say incomplete plainly when returned. Always give admin_url and say a person must review and publish.`

/** How to read a long source, such as a PDF the person attached. Shared by both guides. */
const documentRules = `## From a document
People often attach a PDF or paste a long document. Read all of it before you call a tool. Then put each part in the field the map below gives it, not in the main text. Every fact goes in one field only. A fact with no field goes in source_unmapped with the reason. After saving, list which parts of the document went to which fields, so the person can check them.`

export const courseGuide = (): string => `# Course drafts
Tools: create_course_draft and update_course_draft (id required for update).
${writingRules}
Look up existing courses, the cycle, fellows and any form first.

${documentRules}

| In the document | Field |
| --- | --- |
| Course name | title |
| Second line or tagline under the name | subtitle |
| One-sentence pitch | summary |
| Opening quote or question | epigraph |
| About, overview, aims, why this course | description: prose only. No dates, times, fees, teachers, reading lists or week-by-week plan |
| Teachers, fellows, facilitators | fellows: ids from lookup. Their biographies belong to the person record, not the course: put them in source_unmapped |
| Week-by-week or session-by-session plan | syllabus: one row per session, in order. Its topic is title, its text is description |
| Readings for one session | that session's bibliography |
| Assignments, exercises, field visits for one session | that session's activities |
| General reading list for the whole course | bibliography |
| Dates and times of each session | that session's meetings: one row per meeting |
| A start date or a number of weeks, with no dates for the sessions | announced |
| Words about timing the dates cannot say ("hybrid for the first 6 weeks") | timing_note |
| In person, online or both | location; a session that differs uses syllabus[].delivery |
| Teaching languages | teaching_languages; mixed use goes in language_note |
| Fees, contribution, discounts, scholarships | pricing_override |
| How and when to apply, deadline, application link | registration |
| Questions applicants must answer | applicant_questions |
| What to bring, attendance, how work is assessed | facilitator_note |
| Sensitive material | content_warning |
| "The syllabus may change" | syllabus_tentative: true |
| Images | cover_image only with a media id from lookup. You cannot upload an image: say so |
Required on create: title.en, course_type. Cycle is optional for drafts and required at approval or publication.
Course types:\n${list(COURSE_TYPE_OPTIONS)}
Locations:\n${list(LOCATION_OPTIONS)}
Teaching languages:\n${list(TEACHING_LANGUAGE_OPTIONS)}
Session units:\n${list(SESSION_UNIT_OPTIONS)}

Sessions are the course's syllabus: syllabus [{ title (localized), meetings [{ date, start_time, end_time }], delivery, description (localized Markdown), bibliography [{type,title,href,note}], activities [{kind,description}], cancelled }]. Each session holds its own meetings; there is no weekly pattern. A meeting's date is a Cairo day, YYYY-MM-DD; start_time and end_time are 24-hour HH:MM in Africa/Cairo, the end after the start; leave both times out for an all-day meeting. Write out every meeting: for "Tuesdays 19:00-21:00 for 8 weeks from 3 March", give 8 sessions with one meeting each, a week apart. A session that meets twice a week (a "week" of a course) has two meetings. The dates must agree with the weekdays the source names; if they do not, ask the person. A session with no known date has no meetings. Sessions are ordered by their first meeting, and those with no meeting by their place in the list. Leave title out to show "Session 3" or "Week 3" by session_unit.
syllabus replaces the course's whole list: give a session's id (syllabus_ids in the last result, in the same order) to keep and change it; a session left out is deleted. A course's sessions have no drafts of their own: they are written with a draft course and hidden while it is a draft. On a published course, syllabus is refused, because a change would be public at once: tell the person to edit the sessions in the admin.
announced { start_day, weeks } is only for a course with no meeting yet: the day it was announced to start (YYYY-MM-DD) and how many weeks it runs. Once a session has a meeting, the meetings say this; do not give both.
For a per-session delivery split, set syllabus[].delivery to ONLINE, OFFLINE or HYBRID using the same values as course location. Empty delivery inherits the course-level location. When sessions differ, set course location to ["HYBRID"]. Use timing_note for additional timing notes.
Registration uses mode: follow_cycle (default), own, or closed. follow_cycle uses the cycle destination and deadline, with optional close_early (last day in Cairo). own uses method (form or external), form or url, and deadline without cycle fallback. closed takes no applications. Applicant questions are real blocks with blockType and the fields in the schema; leave their name and option values out, and the course makes them once from the English labels. Phone blocks use blockType phone and defaultCountry (a supported ISO code, default EG). Every question description takes localized Markdown: bold, italic, links, paragraphs and lists. They are unused with external registration. To ask more questions for a follow_cycle course, add them to applicant_questions: the site adds them to the cycle form for applicants who choose this course. Do not make a form for it.
Contribution override uses options [{amount,default}] with nonnegative EGP amounts and exactly one default when options exist, localized note and need_based_deductions. Payment plans are available only on programmes.
${contract('courses')}
`

export const articleGuide = (): string => `# Article drafts
Tools: create_article_draft and update_article_draft (id required for update).
${writingRules}
Look up existing articles and all authors first. Required on create: title.en and at least one author id.

${documentRules}

| In the document | Field |
| --- | --- |
| Title | title |
| Author byline | authors: ids from lookup. Never write the byline into body |
| Main text | body, with its headings, quotes and lists in Markdown. Leave out the title, byline, notes and credits |
| Footnotes or endnotes | real footnotes in body: [^1] in the text and [^1]: note text, in each locale |
| Translator, editor, photographer, illustrator | credits: one row per role, people from lookup |
| "Translated from", the original title, author and source | translation |
| Keywords or topics | tags |
| Short abstract or teaser | meta.description |
| Other articles it names on this site | related_articles: ids from lookup |
| Images | cover_image only with a media id from lookup. You cannot upload an image: say so |
Body Markdown becomes the real article body. Use [^1] and [^1]: note text for real inline footnotes, separately in each locale. Missing, duplicate or unreferenced definitions are refused. An explicit same-site link becomes a mention only when its canonical URL identifies exactly one accessible record. Other names and links stay unchanged; do not infer a person from an ambiguous name.
Tags use [{tag:"topic"}]. Credits use [{role, label:{en?,ar?}, people:[id]}]. Related articles use ids. Translation includes original_language, original_title, original_authors, original_url, original_source, and localized note.
Original languages:\n${list(LANGUAGE_OPTIONS)}
${contract('articles')}
`

export const formGuide = (): string => `# Registration forms

Tool: \`create_form_and_link\`.

Every form asks **name** and **email** first. Do not add them; a question called \`name\` or \`email\` is refused.

## Questions
Each question has \`label\` (\`{ en, ar? }\`), optional localized Markdown \`description\` (bold, italic, links, paragraphs and lists) and \`required\`. Leave \`name\` out: the form makes it from the English label, or \`question_<id>\` for an Arabic-only label, and adds \`_2\` to a repeated one. A given name must use lower-case letters, digits and underscores, start with a letter, and be unique.
- \`type\` text-like (${TEXT_QUESTION_TYPES.join(', ')}): the answer is typed or ticked.
- \`type\` choice (${CHOICE_QUESTION_TYPES.join(', ')}): also give \`options\`, each \`{ en, ar? }\`. select is a menu, radio is one choice, checkboxGroup is several. Leave each option's \`value\` out: it is made once from the English text, like a name, and answers are saved as it. People always see the option's text.

- \`type\` phone: an international phone number saved as E.164; optional \`defaultCountry\` is a supported PHONE_COUNTRIES ISO code (default EG).

File uploads, country and state menus, and text blocks are not available here.

## Template
A new form is a copy of the workshop template named in Registration defaults. The template's questions, emails and thank-you message come with it, and the questions given come after the template's. A given name that one of the template's questions already has is refused. If no workshop template is set, the form has only name, email and the questions given, and the result says so. Lookup never returns templates.

## One form per title
A form with the same English title as an existing one is refused, and the answer names it: a repeated request would otherwise make a second form. Tell the user, and ask them to check the first one. Only if they really want two with the same title, call again with \`create_another: true\`.

## Linking
First read the course's registration mode.
- \`follow_cycle\` (the default): applicants choose the course in its cycle's form. Do not make a form. Add the questions to the course's \`applicant_questions\` with \`update_course_draft\`. Linking is refused, because it would take the course out of the cycle form. Only if the user wants the course to leave the cycle form, set \`link.switch_to_own: true\`.
- \`own\` or \`closed\`: \`link: { target: "course", id }\` sets the course to own registration using this form.
- A draft course stays a draft.
- A published course is not touched: the link is saved as a draft beside the live page, and a person publishes it.
- A cycle cannot be linked here: it has no drafts, so it would change at once. Say so and tell the user to do it in the admin.

## Not covered
Emails and redirects beyond the template's. An admin sets these. The thank-you message can be given; otherwise the template's, or a default, is used.
`

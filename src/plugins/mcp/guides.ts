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

export const courseGuide = (): string => `# Course drafts
Tools: create_course_draft and update_course_draft (id required for update).
${writingRules}
Look up existing courses, the cycle, fellows and any form first.
Required on create: title.en, course_type. Cycle is optional for drafts and required at approval or publication.
Course types:\n${list(COURSE_TYPE_OPTIONS)}
Locations:\n${list(LOCATION_OPTIONS)}
Teaching languages:\n${list(TEACHING_LANGUAGE_OPTIONS)}
Session units:\n${list(SESSION_UNIT_OPTIONS)}

Schedule shape: { start_date, start_precision: "day" | "week", weeks, slots: [{ weekday, start_time, end_time }], note: { en?, ar? } }. Times are 24-hour HH:MM in Africa/Cairo. Dates come from the shared expansion (ADR 0002); do not materialize generated dates into sessions. A start date must match one of the weekly slots unless precision is week. Conflicting dates and weekdays must be clarified with the person. Session dates, when explicitly supplied, replace the generated dates for that session and are saved as supplied.
Sessions use order, session_title (localized), meetings, cancelled, description (localized Markdown), dates [{date,start_time,end_time}], bibliography [{type,title,href,note}], and activities [{kind,description}].
For a per-session delivery split, set sessions[].delivery to ONLINE, OFFLINE or HYBRID using the same values as course location. Empty delivery inherits the course-level location. When sessions differ, set course location to ["HYBRID"]. Use schedule.note for additional schedule notes.
Registration uses mode: follow_cycle (default), own, or closed. follow_cycle uses the cycle destination and deadline, with optional close_early (last day in Cairo). own uses method (form or external), form or url, and deadline without cycle fallback. closed takes no applications. Applicant questions are real blocks with blockType and the fields in the schema; leave their name and option values out, and the course makes them once from the English labels. Phone blocks use blockType phone and defaultCountry (a supported ISO code, default EG). Every question description takes localized Markdown: bold, italic, links, paragraphs and lists. They are unused with external registration. To ask more questions for a follow_cycle course, add them to applicant_questions: the site adds them to the cycle form for applicants who choose this course. Do not make a form for it.
Contribution override uses options [{amount,default}] with nonnegative EGP amounts and exactly one default when options exist, localized note and need_based_deductions. Payment plans are available only on programmes.
${contract('courses')}
`

export const articleGuide = (): string => `# Article drafts
Tools: create_article_draft and update_article_draft (id required for update).
${writingRules}
Look up existing articles and all authors first. Required on create: title.en and at least one author id.
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

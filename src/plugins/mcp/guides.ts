import { FIELD_REGISTRY } from './field-registry'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import {
  LOCATION_OPTIONS,
  SESSION_UNIT_OPTIONS,
  TEACHING_LANGUAGE_OPTIONS,
} from '@/fields/course-options'
import { LANGUAGE_OPTIONS } from '@/fields/language'
import { REGISTRATION_METHODS } from '@/lib/registration'

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
Required on create: title.en, cycle, course_type.
Course types:\n${list(COURSE_TYPE_OPTIONS)}
Locations:\n${list(LOCATION_OPTIONS)}
Teaching languages:\n${list(TEACHING_LANGUAGE_OPTIONS)}
Session units:\n${list(SESSION_UNIT_OPTIONS)}

Schedule shape: { start_date, start_precision: "day" | "week", weeks, slots: [{ weekday, start_time, end_time }], note: { en?, ar? } }. Times are 24-hour HH:MM in Africa/Cairo. Dates come from the shared expansion (ADR 0002); do not materialize generated dates into sessions. A start date must match one of the weekly slots unless precision is week. Conflicting dates and weekdays must be clarified with the person. Session dates, when explicitly supplied, replace the generated dates for that session and are saved as supplied.
Sessions use order, session_title (localized), meetings, cancelled, description (localized Markdown), dates [{date,start_time,end_time}], bibliography [{type,title,href,note}], and activities [{kind,description}].
For a per-session delivery split, set sessions[].delivery to ONLINE, OFFLINE or HYBRID using the same values as course location. Empty delivery inherits the course-level location. When sessions differ, set course location to ["HYBRID"]. Use schedule.note for additional schedule notes.
Registration uses method (${REGISTRATION_METHODS.join(', ')}), form, url, deadline. Empty registration fields use the cycle values, as resolved by courseRegistration(); no "inherit" enum. Applicant questions are real blocks with blockType and the fields in the schema; never add them to external registration.
Pricing override uses min/max, EGP currency, localized note, need_based_deductions and payment_plans [{label,installments:[{amount}]}].
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
Each question has \`name\` (machine name, lower case, unique), \`label\` (\`{ en, ar? }\`), optional \`description\` and \`required\`.
- \`type\` text-like (${TEXT_QUESTION_TYPES.join(', ')}): the answer is typed or ticked.
- \`type\` choice (${CHOICE_QUESTION_TYPES.join(', ')}): also give \`options\`, each \`{ en, ar? }\`. select is a menu, radio is one choice, checkboxGroup is several.

File uploads, country and state menus, and text blocks are not available here.

## One form per title
A form with the same English title as an existing one is refused, and the answer names it: a repeated request would otherwise make a second form. Tell the user, and ask them to check the first one. Only if they really want two with the same title, call again with \`create_another: true\`.

## Linking
\`link: { target: "course", id }\` sets the course's registration to this form.
- A draft course stays a draft.
- A published course is not touched: the link is saved as a draft beside the live page, and a person publishes it.
- A cycle cannot be linked here: it has no drafts, so it would change at once. Say so and tell the user to do it in the admin.

## Not covered
The emails a form sends and where it redirects. An admin sets these. The thank-you message can be given; a default is used if not.
`

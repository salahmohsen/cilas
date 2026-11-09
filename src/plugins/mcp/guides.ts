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

export const courseGuide = (): string => `# Course drafts

Tool: \`create_course_draft\`. The result is always a draft. A person publishes it in the admin.

## Before you call it
1. \`lookup\` kind \`courses\` with the title, to find a duplicate (drafts show too).
2. \`lookup\` kind \`cycles\` to find the cycle id (required).
3. \`lookup\` kind \`people\` for each teacher (fellows). Never invent an id.

## Fields
- \`title\`: \`{ en, ar? }\`. English is required.
- \`subtitle\`, \`summary\`, \`epigraph\`, \`language_note\`: optional \`{ en?, ar? }\` text.
- \`description\`: \`{ en?, ar? }\` Markdown. Headings, lists, quotes, bold, italic and links (https, http, mailto) work. Footnotes do not (see the article guide).
- \`course_type\` (required):
${list(COURSE_TYPE_OPTIONS)}
- \`cycle\` (required): a cycle id.
- \`fellows\`: person ids.
- \`session_unit\`:
${list(SESSION_UNIT_OPTIONS)}
- \`teaching_languages\`:
${list(TEACHING_LANGUAGE_OPTIONS)}
- \`location\`:
${list(LOCATION_OPTIONS)}
- \`registration\`, one of:
  - \`{ "method": "inherit" }\`: use the cycle's setting (default).
  - \`{ "method": "form", "form": <form id> }\`: a site form. Make one with \`create_form_and_link\`.
  - \`{ "method": "external", "url": "https://…" }\`
  - \`{ "method": "closed" }\`
  (The site's methods are: ${REGISTRATION_METHODS.join(', ')}; inherit means none is set.)

## Not covered
Schedule, sessions, bibliography, price and cover image. Tell the user to add them in the admin.

## After
Give the user the admin path from the result and say a person must review and publish.
`

export const articleGuide = (): string => `# Article drafts

Tool: \`create_article_draft\`. The result is always a draft. A person publishes it in the admin.

## Before you call it
1. \`lookup\` kind \`articles\` with the title, to find a duplicate.
2. \`lookup\` kind \`people\` for each author (at least one). Never invent an id.

## Fields
- \`title\`: \`{ en, ar? }\`. English is required.
- \`body\`: \`{ en?, ar? }\` Markdown. Headings, lists, quotes, bold, italic and links (https, http, mailto) work.
- \`authors\`: person ids.
- \`tags\`: short topic words.
- \`requested_tier\`: \`community\` or \`public\`. Only a request; the editor decides.
- \`translation\`: for a translated article only. \`original_language\` is one of:
${list(LANGUAGE_OPTIONS)}
  with optional \`original_title\` and \`original_url\`.

## Footnotes
Footnotes on the site are inline blocks. Markdown such as \`[^1]\` is not converted: it stays as plain text. Do not write footnote markers. Put sources in the text, or tell the user to add footnotes in the admin.

## Not covered
Cover image, credits, related articles, featured, and publication date. Articles are not linked to courses.
`

export const formGuide = (): string => `# Registration forms

Tool: \`create_form_and_link\`.

Every form asks **name** and **email** first. Do not add them; a question called \`name\` or \`email\` is refused.

## Questions
Each question has \`name\` (machine name, lower case, unique), \`label\` (\`{ en, ar? }\`), optional \`description\` and \`required\`.
- \`type\` text-like (${TEXT_QUESTION_TYPES.join(', ')}): the answer is typed or ticked.
- \`type\` choice (${CHOICE_QUESTION_TYPES.join(', ')}): also give \`options\`, each \`{ en, ar? }\`. select is a menu, radio is one choice, checkboxGroup is several.

File uploads, country and state menus, and text blocks are not available here.

## Linking
\`link: { target: "course", id }\` sets the course's registration to this form.
- A draft course stays a draft.
- A published course is not touched: the link is saved as a draft beside the live page, and a person publishes it.
- A cycle cannot be linked here: it has no drafts, so it would change at once. Say so and tell the user to do it in the admin.

## Not covered
The emails a form sends, redirects, and the confirmation text. An admin sets these.
`

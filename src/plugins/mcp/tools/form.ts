import { z } from 'zod/v3'

import { nameQuestions } from '@/forms/question-name'
import { copyDefaultTemplate } from '@/forms/templates'
import { courseRegistrationMode } from '@/lib/course-registration'
import { relId } from '@/lib/relation'
import type { Form } from '@/payload-types'

import { ToolInputError } from '../errors'
import { questionSchema, RESERVED_QUESTION_NAMES, type Question } from '../form-questions'
import { adminUrl, assertExist } from '../references'
import { markdownToLexical } from '../markdown'
import { id, localizedText, optionalLocalizedText } from '../schemas'
import { adminTool } from '../tool'
import { inTransaction } from '../transaction'
import { withAssistantLock } from '../lock'
import { literalSubstring } from '../query'
import type { ToolContext } from '../types'

type Locale = 'en' | 'ar'

const blockFor = (question: Question & { name: string }, locale: Locale) => ({
  blockType: question.type,
  name: question.name,
  required: question.required,
  ...(question.label[locale] ? { label: question.label[locale] } : {}),
  ...(question.description?.[locale] ? { description: question.description[locale] } : {}),
  ...('options' in question
    ? {
        options: question.options.map((option) => ({
          value: option.value,
          // A choice needs a label in every language, so a missing one shows English.
          label: option[locale] ?? option.en,
        })),
      }
    : {}),
})

const formTitled = async ({ payload, req }: ToolContext, title: string) => {
  const { docs } = await payload.find({
    collection: 'forms',
    where: { title: { contains: literalSubstring(title) } },
    limit: 0,
    pagination: false,
    depth: 0,
    locale: 'en',
    fallbackLocale: false,
    select: { title: true },
    overrideAccess: false,
    user: req.user,
    req,
  })
  const wanted = title.trim().toLowerCase()
  return docs.find(
    (doc) =>
      String(doc.title ?? '')
        .trim()
        .toLowerCase() === wanted,
  )
}

type Block = NonNullable<Form['fields']>[number]

const blockName = (block: Block) => ('name' in block ? block.name : undefined)

/**
 * Reads the course to link and refuses one that follows its cycle unless the
 * input says to switch it: linking a form takes the course out of the cycle form.
 */
const courseToLink = async (ctx: ToolContext, link: { id: number; switch_to_own: boolean }) => {
  const { payload, req, user } = ctx
  await assertExist(ctx, 'courses', [link.id], 'Course')
  const current = await payload.findByID({
    collection: 'courses',
    id: link.id,
    draft: true,
    depth: 0,
    locale: 'en',
    select: { title: true, registration: true, cycle: true },
    overrideAccess: false,
    user,
    req,
  })
  if (courseRegistrationMode(current.registration) === 'follow_cycle' && !link.switch_to_own) {
    const cycleId = relId(current.cycle)
    const cycle = cycleId
      ? await payload.findByID({
          collection: 'cycles',
          id: cycleId,
          depth: 0,
          select: { title: true },
          overrideAccess: false,
          user,
          req,
        })
      : null
    const cycleName = cycle ? `the cycle "${cycle.title}" (cycle ${cycle.id})` : 'its cycle'
    throw new ToolInputError(
      `Course ${link.id} ("${current.title}") follows the registration of ${cycleName}: applicants choose it in the cycle's form. Linking a form would give it its own registration and take it out of that form. Nothing was created. To ask this course's applicants more questions, add them to the course's applicant_questions with update_course_draft. Only if the user wants this course to leave the cycle form, call again with link.switch_to_own set to true.`,
    )
  }
  const published = await payload.count({
    collection: 'courses',
    where: { and: [{ id: { equals: link.id } }, { _status: { equals: 'published' } }] },
    overrideAccess: false,
    user,
    req,
  })
  return { registration: current.registration, wasPublished: published.totalDocs > 0 }
}

export const createFormAndLinkTool = adminTool({
  name: 'create_form_and_link',
  description:
    "Create a registration form, and optionally link it to a course. The form starts as a copy of the workshop template in Registration defaults, and the questions given come after the template's. Every form already asks name and email first, so do not add them. A course that follows its cycle is refused unless link.switch_to_own is true: give it applicant_questions with update_course_draft instead. A published course is never changed: the link is saved as a draft beside the live page, and a person publishes it. Cycles cannot be linked because they have no drafts. Returns the form id and a link to it, and, when linked, the course draft. A form with the same English title is refused unless create_another is true.",
  shape: {
    title: localizedText('The form title', 200),
    questions: z
      .array(questionSchema)
      .min(1)
      .max(30)
      .describe("The questions after name, email and the template's questions, in order."),
    confirmation_message: optionalLocalizedText(
      "The thank-you message after sending. Leave out to keep the template's.",
      500,
    ),
    submit_button_label: z.string().trim().max(60).optional().describe('The submit button text.'),
    create_another: z
      .boolean()
      .default(false)
      .describe(
        'Leave this out. A form with the same English title is refused, because a repeated request would make a second form. Set it to true only if the user really wants two forms with the same title.',
      ),
    link: z
      .object({
        target: z
          .enum(['course', 'cycle'])
          .describe('What to link. Only a course can be linked: a cycle has no drafts.'),
        id: id('the course'),
        switch_to_own: z
          .boolean()
          .default(false)
          .describe(
            'Leave this out. A course that follows its cycle is refused, because linking a form takes it out of the cycle form. Set it to true only if the user wants the course to have its own registration.',
          ),
      })
      .optional()
      .describe('Set to use this form for a course’s applications.'),
  },
  run: async (input, ctx) =>
    withAssistantLock(
      ctx.payload,
      `form:${input.title.en.trim().toLowerCase()}`,
      () => {
        throw new ToolInputError(
          'A form with this title is already being created. Check for it before trying again.',
        )
      },
      async () => {
        const { payload, req, user } = ctx
        if (input.link?.target === 'cycle') {
          throw new ToolInputError(
            'A cycle cannot be linked from here: a cycle has no drafts, so a change would go live at once. Nothing was created. Link the form to the cycle in the admin, or link it to a course instead.',
          )
        }
        const names = input.questions.flatMap((question) => (question.name ? [question.name] : []))
        const repeated = names.find((name, index) => names.indexOf(name) !== index)
        if (repeated)
          throw new ToolInputError(`Two questions are named "${repeated}". Names must be unique.`)
        const course = input.link ? await courseToLink(ctx, input.link) : undefined
        if (!input.create_another) {
          const same = await formTitled(ctx, input.title.en)
          if (same) {
            throw new ToolInputError(
              `A form called "${input.title.en}" already exists: form ${same.id} (${adminUrl('forms', Number(same.id))}). Nothing was created. It may be from an earlier attempt: tell the user, and ask them to check it and its course link. To make another form with the same title on purpose, call this again with create_another set to true.`,
            )
          }
        }

        const hasArabic = Boolean(
          input.title.ar ||
          input.confirmation_message?.ar ||
          input.questions.some(
            (q) =>
              q.label.ar || q.description?.ar || ('options' in q && q.options.some((o) => o.ar)),
          ),
        )

        const outcome = await inTransaction(req, async () => {
          const template = await copyDefaultTemplate(req, 'workshop_template', input.title.en)
          const thanks =
            input.confirmation_message?.en ??
            (template ? undefined : 'Thank you. We have received your application.')
          const confirmation = thanks
            ? await markdownToLexical(payload, 'default', thanks)
            : undefined

          const templateBlocks = template
            ? ((
                await payload.findByID({
                  collection: 'forms',
                  id: template.id,
                  locale: 'en',
                  fallbackLocale: false,
                  depth: 0,
                  overrideAccess: false,
                  user,
                  req,
                })
              ).fields ?? [])
            : []
          const taken = templateBlocks.map(blockName).filter((name) => names.includes(name ?? ''))
          if (taken.length) {
            throw new ToolInputError(
              `The workshop template already asks ${taken.map((n) => `"${n}"`).join(', ')}. Nothing was created. Give those questions other names, leave their names out, or leave the questions out.`,
            )
          }
          const named = nameQuestions(
            input.questions.map((q) => ({
              name: q.name,
              label: q.label.en,
              options:
                'options' in q ? q.options.map((o) => ({ value: o.value, label: o.en })) : null,
            })),
            {
              reserved: [
                ...RESERVED_QUESTION_NAMES,
                ...templateBlocks.flatMap((b) => blockName(b) ?? []),
              ],
            },
          )
          const questions = input.questions.map((q, i) => ({
            ...q,
            name: named[i]!.name!,
            ...('options' in q
              ? {
                  options: q.options.map((o, j) => ({
                    ...o,
                    value: named[i]!.options![j]!.value!,
                  })),
                }
              : {}),
          }))
          const data = {
            title: input.title.en,
            fields: [...templateBlocks, ...questions.map((q) => blockFor(q, 'en'))],
            ...(input.submit_button_label ? { submitButtonLabel: input.submit_button_label } : {}),
            ...(confirmation
              ? { confirmationType: 'message', confirmationMessage: confirmation }
              : {}),
          } as unknown as Omit<Form, 'id' | 'createdAt' | 'updatedAt'>
          const form = template
            ? await payload.update({
                collection: 'forms',
                id: template.id,
                locale: 'en',
                data,
                overrideAccess: false,
                user,
                req,
              })
            : await payload.create({
                collection: 'forms',
                locale: 'en',
                data,
                overrideAccess: false,
                user,
                req,
              })

          if (hasArabic) {
            // The ids keep each row, so the English text and the template's Arabic stay.
            const arabic = await payload.findByID({
              collection: 'forms',
              id: form.id,
              locale: 'ar',
              fallbackLocale: false,
              depth: 0,
              overrideAccess: false,
              user,
              req,
            })
            const thanks =
              input.confirmation_message?.ar ??
              (arabic.confirmationMessage ? undefined : 'شكرًا لك. وصلنا طلبك.')
            const byName = new Map(questions.map((q) => [q.name, q]))
            await payload.update({
              collection: 'forms',
              id: form.id,
              locale: 'ar',
              data: {
                ...(input.title.ar ? { title: input.title.ar } : {}),
                ...(thanks
                  ? { confirmationMessage: await markdownToLexical(payload, 'default', thanks) }
                  : {}),
                fields: (arabic.fields ?? []).map((block) => {
                  const question = byName.get(blockName(block) ?? '')
                  if (!question) return block
                  const translated = blockFor(question, 'ar')
                  const rows = 'options' in block ? (block.options ?? []) : []
                  return {
                    ...block,
                    ...translated,
                    ...(translated.options
                      ? {
                          options: translated.options.map((o, i) => ({ ...o, id: rows[i]?.id })),
                        }
                      : {}),
                    id: block.id,
                  }
                }),
              } as never,
              overrideAccess: false,
              user,
              req,
            })
          }

          if (input.link && course) {
            await payload.update({
              collection: 'courses',
              id: input.link.id,
              draft: true,
              overrideLock: false,
              locale: 'en',
              data: {
                _status: 'draft',
                registration: {
                  ...course.registration,
                  mode: 'own',
                  method: 'form',
                  form: form.id,
                },
              },
              overrideAccess: false,
              user,
              req,
            })
          }
          return { form, template: template ? { id: template.id } : null }
        })

        return {
          form: { id: outcome.form.id, admin_url: adminUrl('forms', outcome.form.id) },
          ...(input.link && course
            ? {
                linked_course: {
                  id: input.link.id,
                  status: 'draft',
                  admin_url: adminUrl('courses', input.link.id),
                },
              }
            : {}),
          locales: hasArabic ? ['en', 'ar'] : ['en'],
          notes: [
            outcome.template
              ? "The form is a copy of the workshop template in Registration defaults: it asks name and email, then the template's questions, then the questions given. Its emails and, unless one was given, its thank-you message come from the template."
              : 'No workshop template is set in Registration defaults, so the form asks only name and email, then the questions given. No emails are set on the form; an admin adds them in the admin.',
            course?.wasPublished
              ? 'The course is published. The live page is unchanged; the link is a draft beside it. A person must review and publish that draft.'
              : course
                ? 'The course stays a draft. A person must review and publish it.'
                : 'The form is not linked to anything yet.',
          ],
        }
      },
    ),
})

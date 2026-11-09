import { z } from 'zod/v3'

import type { Form } from '@/payload-types'

import { ToolInputError } from '../errors'
import { questionSchema, RESERVED_QUESTION_NAMES, type Question } from '../form-questions'
import { adminUrl, assertExist } from '../references'
import { markdownToLexical } from '../markdown'
import { id, localizedText, optionalLocalizedText } from '../schemas'
import { adminTool } from '../tool'
import { inTransaction } from '../transaction'
import { withAssistantLock } from '../lock'
import type { ToolContext } from '../types'

type Locale = 'en' | 'ar'

const blockFor = (question: Question, locale: Locale) => ({
  blockType: question.type,
  name: question.name,
  required: question.required,
  ...(question.label[locale] ? { label: question.label[locale] } : {}),
  ...(question.description?.[locale] ? { description: question.description[locale] } : {}),
  ...('options' in question
    ? {
        options: question.options.map((option) => ({
          // The value is the English text in both languages, so answers match.
          // A choice needs a label in every language, so a missing one shows English.
          value: option.en,
          label: option[locale] ?? option.en,
        })),
      }
    : {}),
})

import { literalSubstring } from '../query'

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

export const createFormAndLinkTool = adminTool({
  name: 'create_form_and_link',
  description:
    'Create a registration form, and optionally link it to a course. Every form already asks name and email first, so do not add them. A published course is never changed: the link is saved as a draft beside the live page, and a person publishes it. Cycles cannot be linked because they have no drafts. Returns the form id and a link to it, and, when linked, the course draft. A form with the same English title is refused unless create_another is true.',
  shape: {
    title: localizedText('The form title', 200),
    questions: z
      .array(questionSchema)
      .min(1)
      .max(30)
      .describe('The questions after name and email, in order.'),
    confirmation_message: optionalLocalizedText('The thank-you message after sending', 500),
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
        const names = input.questions.map((question) => question.name)
        const repeated = names.find((name, index) => names.indexOf(name) !== index)
        if (repeated)
          throw new ToolInputError(`Two questions are named "${repeated}". Names must be unique.`)
        if (input.link) await assertExist(ctx, 'courses', [input.link.id], 'Course')
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

        const thanks = {
          en: input.confirmation_message?.en ?? 'Thank you. We have received your application.',
          ar: input.confirmation_message?.ar ?? (hasArabic ? 'شكرًا لك. وصلنا طلبك.' : undefined),
        }
        const confirmation = {
          en: await markdownToLexical(payload, 'default', thanks.en),
          ar: thanks.ar ? await markdownToLexical(payload, 'default', thanks.ar) : undefined,
        }

        const outcome = await inTransaction(req, async () => {
          const form = await payload.create({
            collection: 'forms',
            locale: 'en',
            data: {
              title: input.title.en,
              fields: input.questions.map((q) => blockFor(q, 'en')),
              ...(input.submit_button_label
                ? { submitButtonLabel: input.submit_button_label }
                : {}),
              confirmationType: 'message',
              confirmationMessage: confirmation.en,
            } as unknown as Omit<Form, 'id' | 'createdAt' | 'updatedAt'>,
            overrideAccess: false,
            user,
            req,
          })

          if (hasArabic) {
            // The ids keep each row, so the English text stays beside the Arabic.
            const saved = (form.fields ?? []).filter((b) => b.blockType !== 'message')
            const own = saved.filter(
              (b) => !('name' in b) || !RESERVED_QUESTION_NAMES.includes(b.name),
            )
            await payload.update({
              collection: 'forms',
              id: form.id,
              locale: 'ar',
              data: {
                ...(input.title.ar ? { title: input.title.ar } : {}),
                ...(confirmation.ar ? { confirmationMessage: confirmation.ar } : {}),
                fields: [
                  ...saved.filter((b) => !own.includes(b)),
                  ...own.map((block, index) => ({
                    ...block,
                    ...blockFor(input.questions[index]!, 'ar'),
                    id: block.id,
                  })),
                ],
              } as never,
              overrideAccess: false,
              user,
              req,
            })
          }

          let course: { id: number; wasPublished: boolean } | undefined
          if (input.link) {
            const current = await payload.findByID({
              collection: 'courses',
              id: input.link.id,
              draft: true,
              depth: 0,
              locale: 'en',
              select: { registration: true, _status: true },
              overrideAccess: false,
              user,
              req,
            })
            const published = await payload.count({
              collection: 'courses',
              where: {
                and: [{ id: { equals: input.link.id } }, { _status: { equals: 'published' } }],
              },
              overrideAccess: false,
              user,
              req,
            })
            await payload.update({
              collection: 'courses',
              id: input.link.id,
              draft: true,
              overrideLock: false,
              locale: 'en',
              data: {
                _status: 'draft',
                registration: { ...current.registration, method: 'form', form: form.id },
              },
              overrideAccess: false,
              user,
              req,
            })
            course = { id: input.link.id, wasPublished: published.totalDocs > 0 }
          }
          return { form, course }
        })

        return {
          form: { id: outcome.form.id, admin_url: adminUrl('forms', outcome.form.id) },
          ...(outcome.course
            ? {
                linked_course: {
                  id: outcome.course.id,
                  status: 'draft',
                  admin_url: adminUrl('courses', outcome.course.id),
                },
              }
            : {}),
          locales: hasArabic ? ['en', 'ar'] : ['en'],
          notes: [
            'The form asks name and email first, then the questions given.',
            'No emails are set on the form; an admin adds them in the admin.',
            outcome.course?.wasPublished
              ? 'The course is published. The live page is unchanged; the link is a draft beside it. A person must review and publish that draft.'
              : outcome.course
                ? 'The course stays a draft. A person must review and publish it.'
                : 'The form is not linked to anything yet.',
          ],
        }
      },
    ),
})

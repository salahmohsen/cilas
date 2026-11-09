import { z } from 'zod/v3'

import type { Article } from '@/payload-types'

import { markdownToLexical } from '../markdown'
import { adminUrl, assertExist } from '../references'
import { httpUrlText, id, localizedText, markdownText, ORIGINAL_LANGUAGES } from '../schemas'
import { adminTool } from '../tool'
import { inTransaction } from '../transaction'
import type { CreatedDraft } from '../types'

export const createArticleDraftTool = adminTool({
  name: 'create_article_draft',
  description:
    'Create an article as a DRAFT. It is never published: a person must review it in the admin and publish it. Look up the authors first and use their real ids. Give the Arabic version when the user gives it. Returns the draft id and a link to it in the admin.',
  shape: {
    title: localizedText('The article title', 200),
    body: markdownText('The article text'),
    authors: z.array(id('an author')).min(1).max(10).describe('Who wrote it. At least one.'),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional().describe('Topic tags.'),
    requested_tier: z
      .enum(['community', 'public'])
      .optional()
      .describe(
        'Who the author would like to read it. Only a request: the person who publishes decides.',
      ),
    translation: z
      .object({
        original_language: z.enum(ORIGINAL_LANGUAGES).optional().describe('The original language.'),
        original_title: z.string().trim().max(300).optional().describe('The original title.'),
        original_url: httpUrlText.optional().describe('Where the original was published.'),
      })
      .optional()
      .describe('Only for a translated article.'),
  },
  run: async (input, ctx) => {
    const { payload, req, user } = ctx
    await assertExist(ctx, 'people', input.authors, 'Person')

    const body = {
      en: input.body?.en ? await markdownToLexical(payload, 'article', input.body.en) : undefined,
      ar: input.body?.ar ? await markdownToLexical(payload, 'article', input.body.ar) : undefined,
    }
    const hasArabic = Boolean(input.title.ar || body.ar)

    const article = await inTransaction(req, async () => {
      const created = await payload.create({
        collection: 'articles',
        locale: 'en',
        draft: true,
        data: {
          _status: 'draft',
          title: input.title.en,
          ...(body.en ? { body: body.en } : {}),
          authors: input.authors,
          ...(input.tags ? { tags: input.tags.map((tag) => ({ tag })) } : {}),
          ...(input.requested_tier ? { requested_tier: input.requested_tier } : {}),
          ...(input.translation ? { translation: input.translation } : {}),
        } as unknown as Omit<Article, 'id' | 'createdAt' | 'updatedAt'>,
        overrideAccess: false,
        user,
        req,
      })
      if (hasArabic) {
        await payload.update({
          collection: 'articles',
          id: created.id,
          locale: 'ar',
          draft: true,
          data: {
            _status: 'draft',
            ...(input.title.ar ? { title: input.title.ar } : {}),
            ...(body.ar ? { body: body.ar } : {}),
          } as never,
          overrideAccess: false,
          user,
          req,
        })
      }
      return created
    })

    const result: CreatedDraft & { slug?: string | null } = {
      id: article.id,
      slug: article.slug,
      status: 'draft',
      admin_url: adminUrl('articles', article.id),
      locales: hasArabic ? ['en', 'ar'] : ['en'],
      notes: [
        'Not published. A person must review the draft and publish it in the admin.',
        ...(/\[\^[^\]]+\]/.test(`${input.body?.en ?? ''}${input.body?.ar ?? ''}`)
          ? [
              'Footnote markers such as [^1] were saved as plain text, and a line such as "[^1]: note" became its own paragraph. They are not real footnotes: replace them in the admin.',
            ]
          : []),
        'Articles are not linked to courses.',
      ],
    }
    return result
  },
})

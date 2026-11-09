import { z } from 'zod/v3'
import { draftShape } from '../field-registry'
import { writeDraft, unmappedSchema } from '../draft-write'
import { id, localizedText } from '../schemas'
import { adminTool } from '../tool'
import { draftInputError } from '../draft-result'

const articleShape = { ...draftShape('articles'), source_unmapped: unmappedSchema }
export const createArticleDraftTool = adminTool({
  name: 'create_article_draft',
  description:
    'Create an article draft with Markdown body, real footnotes, credits, translation and relationships. Never publishes. Read cilas://guides/article first.',
  inputError: draftInputError,
  shape: {
    ...articleShape,
    title: localizedText('Article title', 200),
    authors: z.array(id('author')).min(1),
  },
  run: async (input, ctx) => writeDraft('articles', input, ctx),
})
export const updateArticleDraftTool = adminTool({
  name: 'update_article_draft',
  description:
    'Correct an existing article draft by id. Omitted fields stay unchanged. Null clears optional fields; arrays replace the whole field. Published versions stay unchanged.',
  inputError: draftInputError,
  shape: { ...articleShape, id: id('article') },
  run: async ({ id, ...input }, ctx) => writeDraft('articles', input, ctx, id),
})

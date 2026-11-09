import type { ToolResult } from './types'

export const draftInputError = (message: string): ToolResult => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(
        {
          completeness: 'incomplete',
          message,
          fields: {
            saved: [],
            not_saved: [{ field: 'input', reason: message }],
            needs_human_review: [],
          },
        },
        null,
        2,
      ),
    },
  ],
  isError: true,
})

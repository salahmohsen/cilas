import { APIError } from 'payload'

/** A problem the AI can fix by changing its input. The message reaches it as is. */
export class ToolInputError extends Error {}

type ValidationData = { errors?: Array<{ path?: string; message?: string }> }

/**
 * The text an AI client reads when a tool fails. Payload's validation
 * messages name the field, so the AI can correct it and try again.
 */
export const describeError = (error: unknown): string => {
  if (error instanceof ToolInputError) return error.message
  if (error instanceof APIError) {
    const errors = (error.data as ValidationData | undefined)?.errors
    if (errors?.length) {
      return `The site refused the draft: ${errors
        .map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))
        .join('; ')}`
    }
    if (error.status < 500) return error.message
  }
  return 'The site could not finish this request. Try once more, then tell the user.'
}

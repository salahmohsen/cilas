import { APIError } from 'payload'

export class ToolInputError extends Error {}

type ValidationData = { errors?: Array<{ path?: string; message?: string }> }

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

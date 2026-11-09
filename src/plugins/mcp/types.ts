import type { Payload, PayloadRequest, TypedUser } from 'payload'
import type { z } from 'zod'

/** What the plugin expects a tool handler to return. */
export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/** Handed to every tool after the admin check and input validation. */
export type ToolContext = {
  req: PayloadRequest
  payload: Payload
  user: TypedUser
}

/** One tool: its input shape and what it does with valid input from an admin. */
export type AdminToolSpec<Shape extends z.ZodRawShape> = {
  name: string
  description: string
  shape: Shape
  run: (input: z.infer<z.ZodObject<Shape>>, context: ToolContext) => Promise<unknown>
}

/** A value in both site languages; English is the base. */
export type Localized = { en: string; ar?: string }

/** What a create tool returns on success. */
export type CreatedDraft = {
  id: number
  status: 'draft'
  admin_path: string
  locales: Array<'en' | 'ar'>
  notes: string[]
}

export type RegistrationInput =
  | { method: 'inherit' }
  | { method: 'form'; form: number }
  | { method: 'external'; url: string }
  | { method: 'closed' }

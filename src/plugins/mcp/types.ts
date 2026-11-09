import type { Payload, PayloadRequest, TypedUser } from 'payload'
import type { z } from 'zod/v3'

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export type ToolContext = {
  req: PayloadRequest
  payload: Payload
  user: TypedUser
}

export type AdminToolSpec<Shape extends z.ZodRawShape> = {
  name: string
  description: string
  inputError?: (message: string) => ToolResult
  shape: Shape
  run: (input: z.infer<z.ZodObject<Shape>>, context: ToolContext) => Promise<unknown>
}

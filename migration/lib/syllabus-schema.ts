import * as z from 'zod'

export const FLOW_PROMPT_VERSION = '1'

const Material = z.object({
  type: z.enum(['reading', 'watch', 'listen', 'prompt', 'other']),
  title: z.string().min(1),
  note: z.string().nullable(),
  href: z.string().nullable(),
})

export const Syllabus = z.object({
  session_unit: z.enum(['week', 'session']),
  sessions: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().nullable(),
      description: z.string(),
      meetings: z.number().int().positive().nullable(),
      materials: z.array(Material),
      activities: z.array(
        z.object({
          kind: z.enum(['discussion', 'field_visit', 'exercise', 'screening', 'presentation', 'other']),
          description: z.string().min(1),
        }),
      ),
    }),
  ),
  bibliography: z.array(Material),
  notes: z.string().nullable(),
})
export type Syllabus = z.infer<typeof Syllabus>

export const flowPrompt = ({
  id,
  method,
  courses,
  text,
  images,
  links = [],
}: {
  id: string
  method: 'text' | 'vision' | 'docx'
  courses: string[]
  text: string
  images: string[]
  /** The document's link annotations; the text shows only their anchor text. */
  links?: Array<{ page: number; url: string }>
}): string => `You are turning one CILAS course flow (a syllabus document) into structured sessions. The flow belongs to: ${courses.join('; ')}.
Flow: ${id}

Rules:
- Use only what the flow says. Copy titles and text verbatim in the flow's language; never translate or summarise.
- sessions: one per unit the flow numbers (week, session, لقاء, أسبوع), in order, order starting at 1. If one unit spans several meetings ("Weeks 2 & 3"), make one session with meetings = that count; otherwise meetings = null.
- session_unit: "week" if the flow numbers weeks, else "session".
- title: the unit's own topic or heading (without "Week 3:"); null if it has none.
- materials: everything participants read, watch, listen to or respond to. type reading | watch | listen | prompt | other. title = the work as cited; note = author/year/pages/edition if given; href = the link if the flow gives one (copy it exactly).
- activities: what happens in class — discussion, field_visit, exercise, screening, presentation, other — with the flow's wording as description.
- description: the rest of the unit's own text (aims, questions, notes), paragraphs separated by a blank line; "" if nothing is left.
- bibliography: general or course-wide readings not tied to one unit.
- notes: anything else worth keeping (assessment, expectations) verbatim; null if none.
- Every link in the flow must appear as some material's href.${
  links.length
    ? `\n\nThe document's links (its text and images show only the underlined words, not these addresses). Attach each to the material on that page it belongs to, as its href; every one must be used:\n${links.map((l) => `- page ${l.page}: ${l.url}`).join('\n')}`
    : ''
}
${
  method === 'vision'
    ? `\nThis flow is in Arabic and its text layer is unreliable. Read every page image below with your Read tool; the OCR text that follows is only a helper (its tables are scrambled; trust the images):\n${images.map((p) => `- ${p}`).join('\n')}\n`
    : ''
}
${method === 'vision' ? 'OCR text' : 'Flow text'}:
"""
${text}
"""`

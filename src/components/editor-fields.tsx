import type { Editable } from '@/lib/editable'

export type EditorField = { label: string; path: string; value: React.ReactNode }

const empty = <span style={{ opacity: 0.55 }}>Empty</span>

/**
 * The fields a page never shows (card summary, tier, SEO…), listed in the
 * admin's live preview only, so the visual editor can reach them: double-click
 * a line to edit it. Visitors never see this box.
 */
export function EditorFields({ pe, fields }: { pe: Editable; fields: EditorField[] }) {
  return (
    <aside
      aria-label="Page settings (editors only)"
      className="mb-8 rounded-md border border-dashed border-(--border) p-4 text-sm"
      dir="ltr"
      lang="en"
    >
      <p className="mb-2 text-xs font-medium text-(--text-muted)">
        Page settings · only editors see this
      </p>
      <dl className="grid gap-1.5 sm:grid-cols-[10rem_1fr]">
        {fields.map(({ label, path, value }) => (
          <div className="contents" key={path}>
            <dt className="text-(--text-muted)">{label}</dt>
            <dd className="min-w-0 truncate" {...pe(path)}>
              {value === null || value === undefined || value === '' ? empty : value}
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  )
}

/** A relationship or upload shown by its title, name or filename. */
export const labelOf = (value: unknown): string | null => {
  if (!value) return null
  if (typeof value !== 'object') return `#${value}`
  const v = value as {
    title?: string
    name?: string
    filename?: string
    alt?: string
    id?: unknown
  }
  return v.title ?? v.name ?? v.alt ?? v.filename ?? (v.id ? `#${v.id}` : null)
}

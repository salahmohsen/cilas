import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Spec §5: `react-markdown`, allowed elements limited to what the editor
 * makes, `remark-gfm` for strikethrough only. `/people/{id}` links become
 * mention chips with the person's current name; other links open in a new
 * tab; raw HTML never renders (react-markdown default). Every block sits
 * with dir="auto".
 */
const ALLOWED = [
  'p',
  'h1',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'hr',
  'strong',
  'em',
  'del',
  'a',
  'br',
] as const

export type PostBodyProps = {
  body: string
  /** person id → current name, for chips (spec: chips show current names) */
  people?: Record<number, string>
  /**
   * person id → href or null. Person pages resolve by slug (and only when
   * the person is public), so the stored `/people/{id}` link renders as a
   * public-page link through this map when there is one, else as a plain
   * chip. The stored text never changes (spec §5).
   */
  peopleLinks?: Record<number, string | null>
}

export const PostBody = ({ body, people = {}, peopleLinks = {} }: PostBodyProps) => (
  <div className="space-y-3">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      allowedElements={[...ALLOWED]}
      unwrapDisallowed={false}
      components={{
        p: ({ children }) => <p dir="auto">{children}</p>,
        h1: ({ children }) => <h1 dir="auto">{children}</h1>,
        h2: ({ children }) => <h2 dir="auto">{children}</h2>,
        h3: ({ children }) => <h3 dir="auto">{children}</h3>,
        li: ({ children }) => <li dir="auto">{children}</li>,
        a: ({ href, children }) => {
          const text = `${children}`
          if (href?.startsWith('/people/')) {
            const id = Number(href.split('/').pop())
            const to = peopleLinks[id] ?? null
            const chip = (
              <span className="mention-chip" dir="auto">
                @{people[id] ?? text.replace(/^@/, '')}
              </span>
            )
            return to ? <a href={to}>{chip}</a> : chip
          }
          return (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        },
      }}
    >
      {body}
    </ReactMarkdown>
  </div>
)

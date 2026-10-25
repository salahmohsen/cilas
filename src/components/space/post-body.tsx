import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { TitledLink } from './titled-link'
import { PersonHover, type PersonCard } from './person-hover'
import styles from './space.module.css'

/**
 * Spec §5: `react-markdown`, allowed elements limited to what the editor
 * makes, `remark-gfm` for strikethrough only. `/people/{id}` links become
 * mention links with the person's current name and card; other links open
 * in a new tab; raw HTML never renders (react-markdown default). Every block
 * sits with dir="auto".
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
  /** The space's people by id: a mention shows the current name and opens the card. */
  people?: Map<number, PersonCard>
  /** Page titles by address: a link whose text is its own address shows the title. */
  titles?: Record<string, string>
}

export const PostBody = ({ body, people, titles }: PostBodyProps) => (
  <div className={styles.markdown}>
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
        blockquote: ({ children }) => <blockquote dir="auto">{children}</blockquote>,
        a: ({ href, children }) => {
          if (href?.startsWith('/people/')) {
            const person = people?.get(Number(href.split('/').pop()))
            const name = person?.name ?? `${children}`.replace(/^@/, '')
            if (!person) return <span className={styles.mentionLink}>{name}</span>
            return (
              <PersonHover person={person}>
                {person.href ? (
                  <a href={person.href} className={styles.mentionLink}>
                    {name}
                  </a>
                ) : (
                  <button type="button" className={styles.mentionLink}>
                    {name}
                  </button>
                )}
              </PersonHover>
            )
          }
          if (href && typeof children === 'string' && children === href)
            return <TitledLink url={href} titles={titles} />
          return (
            <a href={href} target="_blank" rel="noopener noreferrer">
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

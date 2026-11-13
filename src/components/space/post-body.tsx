import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { MARKDOWN_ELEMENTS } from '@/lib/markdown-elements'
import { SESSION_HREF, inlineBlocks, sessionIdsIn, splitBlocks } from '@/lib/session-refs'
import type { SessionRead } from '@/lib/spaces-data'

import { TitledLink } from './titled-link'
import { PersonHover } from './person-hover'
import type { PersonCard } from '@/lib/space-members'
import { SessionBlock } from './session-block'
import { SessionChip, type SessionLinks } from './session-chip'
import styles from './space.module.css'

/**
 * Spec §5: `react-markdown`, allowed elements limited to what the editor
 * makes, `remark-gfm` for strikethrough only. `/people/{id}` links become
 * mention links with the person's current name and card; other links open
 * in a new tab; raw HTML never renders (react-markdown default). Every block
 * sits with dir="auto". A session mention reads as a chip in its sentence; a
 * session block, alone in its paragraph, as the whole session card.
 */

export type PostBodyProps = {
  body: string
  /** The space's people by id: a mention shows the current name and opens the card. */
  people?: Map<number, PersonCard>
  /** Page titles by address: a link whose text is its own address shows the title. */
  titles?: Record<string, string>
  /** The course sessions the body may name: chips link through `links`, blocks read `read` */
  sessions?: { links: SessionLinks | null; read: SessionRead | null }
}

const keepSessions = (url: string) =>
  url.startsWith(SESSION_HREF) ? url : defaultUrlTransform(url)

export const PostBody = ({ body, people, titles, sessions }: PostBodyProps) => {
  const markdown = (text: string, key?: number) => (
    <ReactMarkdown
      key={key}
      remarkPlugins={[remarkGfm]}
      allowedElements={[...MARKDOWN_ELEMENTS]}
      unwrapDisallowed={false}
      urlTransform={keepSessions}
      components={{
        p: ({ children }) => <p dir="auto">{children}</p>,
        // Posts have no Heading 1 (# names a session); an older one reads as a Heading 2.
        h1: ({ children }) => <h2 dir="auto">{children}</h2>,
        h2: ({ children }) => <h2 dir="auto">{children}</h2>,
        h3: ({ children }) => <h3 dir="auto">{children}</h3>,
        li: ({ children }) => <li dir="auto">{children}</li>,
        blockquote: ({ children }) => <blockquote dir="auto">{children}</blockquote>,
        a: ({ href, children }) => {
          if (href?.startsWith(SESSION_HREF))
            return (
              <SessionChip
                id={href.slice(SESSION_HREF.length)}
                links={sessions?.links}
                label={typeof children === 'string' ? children : undefined}
              />
            )
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
      {text}
    </ReactMarkdown>
  )
  if (!sessionIdsIn(body).length) return <div className={styles.markdown}>{markdown(body)}</div>
  return (
    <div className={styles.markdown}>
      {splitBlocks(body).map((part, i) =>
        part.type === 'block' ? (
          <SessionBlock key={i} id={part.id} read={sessions?.read} />
        ) : (
          markdown(inlineBlocks(part.markdown), i)
        ),
      )}
    </div>
  )
}

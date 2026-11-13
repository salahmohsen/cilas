import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { MARKDOWN_ELEMENTS } from '@/lib/markdown-elements'
import { newTab } from '@/lib/new-tab'

/**
 * A session's description, stored as Markdown (ADR 0011), with the elements
 * the editor makes. Raw HTML never renders; a link to another site opens in a new tab.
 */
export function SessionMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={[...MARKDOWN_ELEMENTS]}
        components={{
          a: ({ href, children }) => (
            <a href={href} {...newTab(href ?? '')}>
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

import Link from 'next/link'

import { AI_ACCESS_GUIDE_PATH } from '@/plugins/mcp/paths'

/**
 * Above the lists of connected assistants, assistant apps and keys: the way to
 * the guide (the theme's sidebar has no place for custom links).
 */
export function AiAccessLink() {
  return (
    <div
      className="cilas-admin-box"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        margin: '0 0 16px',
      }}
    >
      <span>An AI assistant can make drafts for you. A person always publishes.</span>
      <Link href={AI_ACCESS_GUIDE_PATH} style={{ fontWeight: 600 }}>
        Connect an AI assistant →
      </Link>
    </div>
  )
}

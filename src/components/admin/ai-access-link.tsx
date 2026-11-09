import Link from 'next/link'

import { AI_ACCESS_GUIDE_PATH } from '@/plugins/mcp/paths'

/**
 * Above the AI access list and at the top of a key's page: the way to the
 * guide (the theme's sidebar has no place for custom links).
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
      <span>A key lets an AI assistant make drafts. A person always publishes.</span>
      <Link href={AI_ACCESS_GUIDE_PATH} style={{ fontWeight: 600 }}>
        How to connect an AI assistant →
      </Link>
    </div>
  )
}

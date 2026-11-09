import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import { MENTION_TYPES } from '@/blocks/mention'
import { env } from '@/env'
import { detailPath } from '@/lib/paths'
import type { ToolContext } from './types'
import { randomUUID } from 'node:crypto'

type Node = { type?: string; text?: string; fields?: Record<string, unknown>; children?: Node[] }

/** Only an explicit same-site URL with exactly one accessible target establishes identity. */
export async function resolveArticleMentions(state: SerializedEditorState, ctx: ToolContext) {
  const origin = new URL(env.NEXT_PUBLIC_SERVER_URL).origin
  const visit = async (node: Node): Promise<void> => {
    if (!node.children) return
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i]!
      await visit(child)
      if (
        child.type !== 'link' ||
        typeof child.fields?.url !== 'string' ||
        !child.children?.every((n) => n.type === 'text')
      )
        continue
      const url = new URL(child.fields.url, origin)
      if (url.origin !== origin || url.hash || url.search) continue
      const path = url.pathname.replace(/^\/(en|ar)(?=\/)/, '').replace(/\/$/, '')
      const match = MENTION_TYPES.filter((type) =>
        ['courses', 'articles', 'events', 'people'].includes(type.relationTo),
      ).flatMap((type) => {
        const pattern = detailPath(type.relationTo as 'courses', '__slug__').split('__slug__')
        return path.startsWith(pattern[0]!) &&
          path.slice(pattern[0]!.length) &&
          !path.slice(pattern[0]!.length).includes('/')
          ? [{ type, slug: decodeURIComponent(path.slice(pattern[0]!.length)) }]
          : []
      })
      if (match.length !== 1) continue
      const { type, slug } = match[0]!
      const { docs } = await ctx.payload.find({
        collection: type.relationTo,
        where: { slug: { equals: slug } },
        limit: 2,
        depth: 0,
        select: { slug: true },
        draft: true,
        overrideAccess: false,
        user: ctx.user,
        req: ctx.req,
      })
      if (docs.length !== 1) continue
      node.children[i] = {
        type: 'inlineBlock',
        fields: {
          id: randomUUID(),
          blockType: 'mention',
          label: child.children.map((n) => n.text ?? '').join(''),
          type: type.value,
          [type.value]: docs[0]!.id,
        },
        ...{ version: 1, format: '' },
      } as Node
    }
  }
  await visit(state.root)
  return state
}

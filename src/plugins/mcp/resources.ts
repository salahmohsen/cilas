import { isAdminUser } from '@/access'
import type { MCPPluginConfig } from '@payloadcms/plugin-mcp'

import { articleGuide, courseGuide, formGuide, GUIDE_URIS } from './guides'

type PluginResource = NonNullable<NonNullable<MCPPluginConfig['mcp']>['resources']>[number]

const guide = (
  name: string,
  title: string,
  uri: string,
  description: string,
  body: () => string,
): PluginResource => ({
  name,
  title,
  uri,
  description,
  mimeType: 'text/markdown',
  handler: (requested: URL) => {
    // The plugin inserts `req` after the URL: (uri, req, extra).
    return { contents: [{ uri: requested.href, text: body() }] }
  },
})

const adminOnly = (resource: PluginResource): PluginResource => ({
  ...resource,
  handler: (...args: unknown[]) => {
    const req = args[1] as { user?: unknown }
    if (!isAdminUser(req?.user as never)) throw new Error('Access denied. Administrators only.')
    return resource.handler(...args)
  },
})

export const RESOURCES: PluginResource[] = [
  guide(
    'course_guide',
    'Course drafts guide',
    GUIDE_URIS.course,
    'How to describe a course draft: fields, allowed values and the steps before.',
    courseGuide,
  ),
  guide(
    'article_guide',
    'Article drafts guide',
    GUIDE_URIS.article,
    'How to describe an article draft, and what happens to footnotes.',
    articleGuide,
  ),
  guide(
    'form_guide',
    'Registration forms guide',
    GUIDE_URIS.form,
    'How to describe a registration form and link it to a course.',
    formGuide,
  ),
].map(adminOnly)

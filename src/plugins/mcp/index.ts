import { mcpPlugin, type MCPPluginConfig } from '@payloadcms/plugin-mcp'
import type { Plugin } from 'payload'

import { overrideApiKeyCollection } from './api-keys'
import { SERVER_INSTRUCTIONS } from './instructions'
import { oauthMcp } from './oauth'
import { env } from '@/env'
import { PROMPTS } from './prompts'
import { RESOURCES } from './resources'
import { createArticleDraftTool, updateArticleDraftTool } from './tools/article'
import { createCourseDraftTool, updateCourseDraftTool } from './tools/course'
import { createFormAndLinkTool } from './tools/form'
import { lookupTool } from './tools/lookup'

export const MCP_TOOLS = [
  lookupTool,
  createCourseDraftTool,
  createArticleDraftTool,
  createFormAndLinkTool,
  updateCourseDraftTool,
  updateArticleDraftTool,
]

/**
 * An admin-only MCP server at /api/mcp. It has six tools of its own and
 * none of the plugin's: the default find, create, update and delete tools can
 * change live pages, override locks, edit in bulk, and read a course's
 * enrollments. Experimental tools stay off.
 *
 * Administrators connect Claude or ChatGPT with OAuth (./oauth.ts). API keys
 * stay for developers. The OAuth plugin must get this same object.
 */
export const adminMcp = (): Plugin[] => {
  const options: MCPPluginConfig = {
    collections: {},
    globals: {},
    overrideApiKeyCollection,
    mcp: {
      tools: MCP_TOOLS,
      resources: RESOURCES,
      prompts: PROMPTS,
      serverOptions: {
        instructions: SERVER_INSTRUCTIONS,
        serverInfo: { name: 'CILAS admin', version: '1.0.0' },
      },
    },
  }
  const oauth = oauthMcp(options, env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, ''))
  return [mcpPlugin(options), ...oauth]
}

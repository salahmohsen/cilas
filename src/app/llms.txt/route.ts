import config from '@payload-config'
import { createLlmsTxtRouteHandler } from 'payload-plugin-llms-txt/next'

import { llmsOptions } from '@/plugins/llms'

// Rebuilt at most hourly, like the sitemap.
export const revalidate = 3600

export const GET = createLlmsTxtRouteHandler(config, llmsOptions)

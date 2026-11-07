import config from '@payload-config'
import { createLlmsTxtRouteHandler } from 'payload-plugin-llms-txt/next'

import { llmsOptions } from '@/plugins/llms'

export const revalidate = 3600

export const GET = createLlmsTxtRouteHandler(config, llmsOptions)

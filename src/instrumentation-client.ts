import { clientEnv } from '@/env.client'
import { startAnalytics } from '@/lib/analytics/client'

startAnalytics(clientEnv.NEXT_PUBLIC_POSTHOG_KEY)

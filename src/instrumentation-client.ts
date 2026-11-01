import { clientEnv } from '@/env.client'
import { onNavigate, startAnalytics } from '@/lib/analytics/client'

startAnalytics(clientEnv.NEXT_PUBLIC_POSTHOG_KEY)

export function onRouterTransitionStart(url: string) {
  onNavigate(url)
}

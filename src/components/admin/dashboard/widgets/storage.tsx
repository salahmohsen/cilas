import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { env } from '@/env'
import { FREE_CONTACT_LIMIT, accountContactCount } from '@/lib/resend-contacts'

import { cachedStat } from '../cached'
import { WidgetCard } from '../widget-card'

/**
 * Cloudflare R2's free tier (docs/spaces-media-budget.md). A planning budget,
 * not a limit: uploads keep working past it, and R2 only starts to bill.
 */
const MEDIA_BUDGET_MB = 10_240

const MB = 1024 * 1024

const GROUPS = [
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
  { id: 'other', label: 'Other' },
] as const

/** Megabytes per mime group, in `GROUPS` order. */
const mediaMegabytes = () =>
  cachedStat<number[]>('media-storage', async (payload) => {
    const { docs } = await payload.find({
      collection: 'media',
      select: { filesize: true, mimeType: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const bytes = { image: 0, video: 0, audio: 0, other: 0 }
    for (const { filesize, mimeType } of docs) {
      const kind = mimeType?.split('/')[0]
      const group = kind === 'image' || kind === 'video' || kind === 'audio' ? kind : 'other'
      bytes[group] += filesize ?? 0
    }
    return GROUPS.map(({ id }) => bytes[id] / MB)
  })

export async function MediaStorage() {
  const megabytes = await mediaMegabytes()
  return (
    <WidgetCard
      title="Media library"
      description={`Against the ${MEDIA_BUDGET_MB / 1024} GB free storage of Cloudflare R2`}
    >
      <UsageMeter
        label="Media storage"
        segments={GROUPS.map(({ id, label }, i) => ({
          id,
          label,
          value: Math.round((megabytes[i] ?? 0) * 10) / 10,
        }))}
        limit={MEDIA_BUDGET_MB}
        unit="MB"
        decimals={1}
      />
    </WidgetCard>
  )
}

/** Contacts in the Resend account; null when Resend is not set up or does not answer. */
const contacts = () =>
  cachedStat<number | null>(
    'newsletter-contacts',
    async () => (env.RESEND_API_KEY ? accountContactCount(env.RESEND_API_KEY) : null),
    600,
  ).catch(() => null)

export async function NewsletterUsage() {
  const total = await contacts()
  if (total === null) return null
  return (
    <WidgetCard title="Newsletter contacts" description="Against the free Resend plan">
      <UsageMeter
        label="Newsletter contacts"
        segments={[{ id: 'contacts', label: 'Contacts', value: total }]}
        limit={FREE_CONTACT_LIMIT}
        unit="contacts"
        decimals={0}
      />
    </WidgetCard>
  )
}

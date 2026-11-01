import { ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'

import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { env } from '@/env'
import { FREE_CONTACT_LIMIT, accountContactCount } from '@/lib/resend-contacts'
import { BUCKET_PREFIXES, sumByPrefix, sumDocBytes } from '@/lib/storage-usage'

import { cachedStat } from '../cached'
import { WidgetCard } from '../widget-card'

/**
 * Cloudflare R2's free tier (docs/spaces-media-budget.md). A planning budget,
 * not a limit: uploads keep working past it, and R2 only starts to bill.
 */
const MEDIA_BUDGET_MB = 10_240

const MB = 1024 * 1024

const round = (bytes: number) => Math.round((bytes / MB) * 10) / 10

/**
 * What the database says, per upload collection. Counts every image size
 * variant (each is its own R2 object), not only the main file.
 */
const databaseBytes = () =>
  cachedStat<{ media: number; spaces: number; submissions: number }>(
    'media-storage',
    async (payload) => {
      const sum = async (collection: 'media' | 'space-files' | 'submission-files') => {
        const { docs } = await payload.find({
          collection,
          select: collection === 'media' ? { filesize: true, sizes: true } : { filesize: true },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })
        return sumDocBytes(docs)
      }
      const [media, spaces, submissions] = await Promise.all([
        sum('media'),
        sum('space-files'),
        sum('submission-files'),
      ])
      return { media, spaces, submissions }
    },
  )

/** Give up on the bucket listing after this long; the figure is then hidden. */
const LIST_TIMEOUT_MS = 5000

/**
 * Real bytes in the bucket per key prefix, from ListObjectsV2. R2 charges list
 * calls as Class A operations (free up to 1M a month); one call returns 1000
 * objects, so 10 000 objects cost 10 calls per refresh, and the 6 hour cache
 * keeps that near 40 refreshes a month. Null when R2 is not set up, the call
 * fails or it is too slow.
 */
const bucketBytes = () =>
  cachedStat<Record<string, number> | null>(
    'bucket-storage',
    async () => {
      if (!env.R2_BUCKET || !env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY)
        return null
      const client = new S3Client({
        endpoint: env.R2_ENDPOINT,
        region: env.R2_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        },
      })
      const objects: { Key?: string; Size?: number }[] = []
      let token: string | undefined
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: env.R2_BUCKET, ContinuationToken: token }),
          { abortSignal: AbortSignal.timeout(LIST_TIMEOUT_MS) },
        )
        objects.push(...(page.Contents ?? []))
        token = page.NextContinuationToken
      } while (token)
      return sumByPrefix(objects)
    },
    6 * 60 * 60,
  ).catch(() => null)

export async function MediaStorage() {
  const [db, bucket] = await Promise.all([databaseBytes(), bucketBytes()])
  const bucketTotal = bucket ? Object.values(bucket).reduce((a, b) => a + b, 0) : 0
  return (
    <WidgetCard
      title="Media library"
      description={`Against the ${MEDIA_BUDGET_MB / 1024} GB free storage of Cloudflare R2`}
    >
      <UsageMeter
        label="Uploads in the database"
        segments={[
          { id: 'media', label: 'Media', value: round(db.media) },
          { id: 'spaces', label: 'Spaces photos', value: round(db.spaces) },
          { id: 'submissions', label: 'Submissions', value: round(db.submissions) },
        ]}
        limit={MEDIA_BUDGET_MB}
        unit="MB"
        decimals={1}
      />
      {bucket ? (
        <UsageMeter
          label="Bucket total (R2)"
          segments={[
            { id: 'media', label: 'Media', value: round(bucket[BUCKET_PREFIXES.media] ?? 0) },
            {
              id: 'spaces',
              label: 'Spaces photos',
              value: round(bucket[BUCKET_PREFIXES.spaces] ?? 0),
            },
            {
              id: 'submissions',
              label: 'Submissions',
              value: round(bucket[BUCKET_PREFIXES.submissions] ?? 0),
            },
            {
              id: 'other',
              label: 'Other',
              value: round(
                bucketTotal -
                  (bucket[BUCKET_PREFIXES.media] ?? 0) -
                  (bucket[BUCKET_PREFIXES.spaces] ?? 0) -
                  (bucket[BUCKET_PREFIXES.submissions] ?? 0),
              ),
            },
          ]}
          limit={MEDIA_BUDGET_MB}
          unit="MB"
          decimals={1}
        />
      ) : null}
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

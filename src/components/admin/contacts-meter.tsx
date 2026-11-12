import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { CONTACT_WARN_AT, FREE_CONTACT_LIMIT } from '@/lib/resend-contacts'

import { subscribersCopy } from './subscribers-copy'

/** Contacts stored in Resend, against the free plan's limit. */
export function ContactsMeter({ total, ar }: { total: number; ar: boolean }) {
  const t = subscribersCopy(ar).meter
  return (
    <UsageMeter
      label={t.label}
      segments={[{ id: 'contacts', label: t.segment, value: total }]}
      limit={FREE_CONTACT_LIMIT}
      unit={t.unit}
      decimals={0}
      freeLabel={t.free}
      overLabel={t.over}
      warnAt={CONTACT_WARN_AT}
    />
  )
}

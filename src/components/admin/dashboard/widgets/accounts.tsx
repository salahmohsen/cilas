import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { Sparkline } from '@/components/arc/sparkline/sparkline'
import { bucketByDay, periodChange, totalOf } from '@/lib/admin-stats'
import { ROLE_OPTIONS } from '@/collections/Users'
import type { User } from '@/payload-types'

import { cachedStat } from '../cached'
import { WidgetCard } from '../widget-card'

type Account = { createdAt: string; roles: User['roles'] }

const accounts = () =>
  cachedStat<Account[]>('accounts', async (payload) => {
    const { docs } = await payload.find({
      collection: 'users',
      select: { createdAt: true, roles: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return docs.map(({ createdAt, roles }) => ({ createdAt, roles: roles ?? [] }))
  })

export async function AccountsByRole() {
  const all = await accounts()
  return (
    <WidgetCard
      title="Accounts by role"
      description="An account counts once for each role it holds"
    >
      <DonutChart
        data={ROLE_OPTIONS.map(({ label, value }) => ({
          key: value,
          label,
          value: all.filter((account) => account.roles.includes(value)).length,
        }))}
        label="Accounts by role"
        unit="accounts"
        totalLabel="Roles held"
        size={160}
        thickness={18}
        emptyLabel="No accounts yet"
      />
    </WidgetCard>
  )
}

export async function NewAccounts() {
  const stamps = (await accounts()).map((account) => account.createdAt)
  const points = bucketByDay(stamps, 30)
  return (
    <WidgetCard title="New accounts" description="Last 30 days">
      <Sparkline
        data={points.map((point) => point.value)}
        labels={points.map((point) => point.label)}
        label="New accounts"
        value={String(totalOf(points))}
        change={periodChange(stamps, 30) ?? undefined}
        height={96}
        interactive
      />
    </WidgetCard>
  )
}

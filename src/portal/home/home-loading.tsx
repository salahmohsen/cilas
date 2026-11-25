import { useTranslations } from 'next-intl'

import { Announce } from '@/portal/feedback/announce'
import { PortalPageHeader } from '@/portal/lists/page-header'
import { HOME_SLOTS, HomeBoard, HomeCardSkeleton, HomeSlotBox } from './card-boundary'

export function HomeLoading() {
  const t = useTranslations('Portal.home')
  return (
    <div aria-busy="true">
      <Announce message={t('loading')} />
      <PortalPageHeader title={t('greeting')} />
      <HomeBoard>
        {HOME_SLOTS.map((slot) => (
          <HomeSlotBox key={slot} slot={slot}>
            <HomeCardSkeleton slot={slot} />
          </HomeSlotBox>
        ))}
      </HomeBoard>
    </div>
  )
}

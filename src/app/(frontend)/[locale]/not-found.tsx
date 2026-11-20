import { NotFoundPage } from '@/components/not-found-page'
import { SiteFrame } from '@/components/site-frame'

/** Every `notFound()` under a language, and every path nothing else claims. */
export default function NotFound() {
  return (
    <SiteFrame>
      <NotFoundPage />
    </SiteFrame>
  )
}

import React from 'react'

import { SiteFrame } from '@/components/site-frame'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteFrame>{children}</SiteFrame>
}

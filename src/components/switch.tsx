import type { ComponentProps } from 'react'

import { Switch as ArcSwitch } from '@/components/arc/switch/switch'

/** Arc's switch, right to left safe. */
export function Switch(props: ComponentProps<typeof ArcSwitch>) {
  return (
    // Arc's switch moves its thumb with a fixed offset, so it needs a left to right box.
    <span dir="ltr" style={{ display: 'inline-flex' }}>
      <ArcSwitch {...props} />
    </span>
  )
}

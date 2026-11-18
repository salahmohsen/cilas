'use client'

import type { ComponentProps } from 'react'

import { spaceSettingsSetAction } from '@/lib/space-actions'

import { SpaceHeadActions, type SettingsProps } from './space-head-actions'

/** The space head's actions, saving the settings through the space settings server action. */
export function ConnectedSpaceHeadActions({
  settings,
  ...props
}: Omit<ComponentProps<typeof SpaceHeadActions>, 'settings'> & {
  settings: Omit<SettingsProps, 'save'> | null
}) {
  return (
    <SpaceHeadActions
      {...props}
      settings={
        settings && { ...settings, save: (form) => spaceSettingsSetAction({ status: 'ok' }, form) }
      }
    />
  )
}

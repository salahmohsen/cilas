'use client'

import { BlocksFeatureClient, RelationshipFeatureClient } from '@payloadcms/richtext-lexical/client'

export const LegacyRelationshipFeatureClient: typeof RelationshipFeatureClient = (props) => {
  const provider = RelationshipFeatureClient(props)
  const native = provider.feature
  return {
    ...provider,
    feature:
      typeof native === 'function'
        ? (args) => ({ ...native(args), slashMenu: undefined, toolbarFixed: undefined })
        : { ...native, slashMenu: undefined, toolbarFixed: undefined },
  }
}

export const EmailBlocksFeatureClient: typeof BlocksFeatureClient = (props) => {
  const provider = BlocksFeatureClient(props)
  const native = provider.feature
  return {
    ...provider,
    feature: (args) => {
      const feature = typeof native === 'function' ? native(args) : native
      return {
        ...feature,
        slashMenu: {
          groups: feature.slashMenu?.groups?.filter((group) => group.key !== 'blocks') ?? [],
        },
        toolbarFixed: {
          groups: feature.toolbarFixed?.groups?.filter((group) => group.key !== 'blocks') ?? [],
        },
      }
    },
  }
}

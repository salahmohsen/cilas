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

// Saved issues may hold these two, and the email links them; they are not offered for new content.
const NOT_OFFERED = /personProfile|movie/

export const EmailBlocksFeatureClient: typeof BlocksFeatureClient = (props) => {
  const provider = BlocksFeatureClient(props)
  const native = provider.feature
  type Group = { items: { key: string }[] }
  const offered = <G extends Group>(groups: G[] = []): G[] =>
    groups.map((group) => ({
      ...group,
      items: group.items.filter((item) => !NOT_OFFERED.test(item.key)),
    }))
  return {
    ...provider,
    feature: (args) => {
      const feature = typeof native === 'function' ? native(args) : native
      return {
        ...feature,
        slashMenu: { groups: offered(feature.slashMenu?.groups) },
        toolbarFixed: { groups: offered(feature.toolbarFixed?.groups) },
      }
    },
  }
}

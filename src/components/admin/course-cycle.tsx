'use client'

import { RelationshipField, useAuth } from '@payloadcms/ui'
import type { RelationshipFieldClientProps } from 'payload'
import { isAdminUser } from '@/access'

export function CourseCycle(props: RelationshipFieldClientProps) {
  const { user } = useAuth()
  return <RelationshipField {...props} readOnly={props.readOnly || !isAdminUser(user)} />
}

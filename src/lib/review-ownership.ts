import type { CollectionBeforeValidateHook } from 'payload'
import { isAdminUser, personOf } from '@/access'
import { toPersonIds } from '@/lib/fellow-role'

/** Keep a non-admin owner on a new proposal before required field validation. */
export const addSelfAs =
  (field: 'authors' | 'fellows' | 'editors'): CollectionBeforeValidateHook =>
  ({ data, req, operation }) => {
    const self = personOf(req.user)
    if (!data || operation !== 'create' || isAdminUser(req.user) || self === null) return data
    const people = toPersonIds(data[field])
    return people.includes(self) ? data : { ...data, [field]: [...people, self] }
  }

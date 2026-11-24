import {
  combineQueries,
  getLatestCollectionVersion,
  isolateObjectProperty,
  type Access,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
  type SanitizedConfig,
  type Where,
} from 'payload'

import { isAdminUser } from '@/access'
import { relId } from '@/lib/relation'
import { lockRow } from '@/lib/row-lock'
import type { PayloadLockedDocument } from '@/payload-types'

const collection = 'payload-locked-documents'

type LockFields = {
  document?: { relationTo?: unknown; value?: unknown } | null
  globalSlug?: unknown
  user?: { relationTo?: unknown; value?: unknown } | null
}

type LockTarget = { collectionSlug: string; id: number } | { globalSlug: string }

const documentID = (value: unknown): number | undefined => {
  const id = relId(value)
  const number = typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id
  return typeof number === 'number' && Number.isSafeInteger(number) && number > 0
    ? number
    : undefined
}

const targetOf = ({ document, globalSlug }: LockFields): LockTarget | undefined => {
  if (document == null && typeof globalSlug === 'string') return { globalSlug }
  const id = documentID(document?.value)
  if (globalSlug == null && typeof document?.relationTo === 'string' && id !== undefined) {
    return { collectionSlug: document.relationTo, id }
  }
}

const targetWhere = (target: LockTarget): Where =>
  'globalSlug' in target
    ? { globalSlug: { equals: target.globalSlug } }
    : {
        and: [
          { 'document.relationTo': { equals: target.collectionSlug } },
          { 'document.value': { equals: target.id } },
        ],
      }

/** Resolve the target's update constraint against the document, as Payload does on edit. */
const mayEditTarget = async (req: PayloadRequest, target: LockTarget): Promise<boolean> => {
  if (!req.user) return false
  const { payload } = req
  if ('globalSlug' in target) {
    const global = payload.globals.config.find(({ slug }) => slug === target.globalSlug)
    if (!global || global.lockDocuments === false) return false
    const policy = await (global.access.update?.({ req }) ?? true)
    if (typeof policy === 'boolean') return policy
    const doc = await payload.db.findGlobal({ slug: global.slug, where: policy, req })
    return Boolean(doc && Object.keys(doc).length)
  }

  const { id, collectionSlug } = target
  const config = payload.config.collections.find(({ slug }) => slug === collectionSlug)
  if (!config || config.lockDocuments === false) return false
  const policy = await (config.access.update?.({ id, req }) ?? true)
  if (!policy) return false
  let where = combineQueries({ id: { equals: id } }, policy)
  if (config.trash) where = combineQueries(where, { deletedAt: { exists: false } })

  return Boolean(
    await getLatestCollectionVersion({
      id,
      config,
      payload,
      query: { collection: config.slug, locale: req.locale, where },
      req,
    }),
  )
}

/** The form-state handler creates and refreshes locks directly through the adapter. */
export const mayRunEditorLocking = (
  req: PayloadRequest,
  {
    collectionSlug,
    globalSlug,
    id,
  }: { collectionSlug?: string; globalSlug?: string; id?: unknown },
) => {
  const target = targetOf({
    document: collectionSlug === undefined ? undefined : { relationTo: collectionSlug, value: id },
    globalSlug,
  })
  return target ? mayEditTarget(req, target) : false
}

const namesCaller = (holder: LockFields['user'], user: PayloadRequest['user']) => {
  const id = relId(holder?.value)
  return Boolean(
    user &&
    holder?.relationTo === user.collection &&
    (typeof id === 'number' || typeof id === 'string') &&
    String(id) === String(user.id),
  )
}

const lockInCallersNameOnEditableTarget: Access = ({ req, data }) => {
  if (isAdminUser(req.user)) return true
  if (!data || !namesCaller(data.user, req.user)) return false
  const target = targetOf(data)
  return target ? mayEditTarget(req, target) : false
}

const lockByID = async (req: PayloadRequest, id: number | string, forMutation = false) => {
  // Serialize holder checks with takeover and release on the same row. Without
  // a transaction nothing is serialized, so a mutation is refused.
  if (forMutation && !(await lockRow(req, collection, id))) return null
  return req.payload.db.findOne<PayloadLockedDocument>({
    collection,
    req,
    where: { id: { equals: id } },
  })
}

const takeOverEditableTargetLock: Access = async ({ req, id, data }) => {
  if (data && ('document' in data || 'globalSlug' in data)) return false
  if (isAdminUser(req.user)) return true
  if (!req.user || id === undefined || !namesCaller(data?.user, req.user)) return false
  const lock = await lockByID(req, id, true)
  const target = lock && targetOf(lock)
  return target ? (await mayEditTarget(req, target)) && targetWhere(target) : false
}

const releaseOwnEditableTargetLock: Access = async ({ req, id }) => {
  if (isAdminUser(req.user)) return true
  if (!req.user || id === undefined) return false
  const lock = await lockByID(req, id, true)
  if (!lock || !namesCaller(lock.user, req.user)) return false
  const target = targetOf(lock)
  return target ? (await mayEditTarget(req, target)) && targetWhere(target) : false
}

/**
 * The find's target rides in the request context as a value: Payload checks
 * field permissions with request proxies of its own, and a nested Local API
 * call swaps the context for a copy, so only a copied entry stays reachable.
 */
const LOCK_SCOPE = 'documentLockScope'

const conjunctiveEquals = (where: Where, field: string): unknown => {
  const condition = where[field]
  if (condition && !Array.isArray(condition) && condition.equals !== undefined) {
    return condition.equals
  }
  for (const clause of Array.isArray(where.and) ? where.and : []) {
    if (!clause || typeof clause !== 'object') continue
    const value = conjunctiveEquals(clause, field)
    if (value !== undefined) return value
  }
}

/** Both the Local API edit view and REST name a target in their find query. */
const scopeLockLookup: CollectionBeforeOperationHook = ({
  args,
  operation,
  overrideAccess,
  req,
}) => {
  if (operation !== 'read' || overrideAccess || !req.user || isAdminUser(req.user)) return args
  const where = 'where' in args && args.where
  if (!where) return args
  const relationTo = conjunctiveEquals(where, 'document.relationTo')
  const value = conjunctiveEquals(where, 'document.value')
  const target = targetOf({
    document: relationTo === undefined && value === undefined ? undefined : { relationTo, value },
    globalSlug: conjunctiveEquals(where, 'globalSlug'),
  })
  if (!target) return args

  // Access doesn't receive find's where. Bind its scope to this operation only.
  const scopedReq = isolateObjectProperty(req, 'context')
  scopedReq.context = { ...req.context, [LOCK_SCOPE]: target }
  return { ...args, req: scopedReq }
}

/** Who is editing is for the people who can edit, not everyone who can read. */
const readLocksOnEditableTarget: Access = async ({ req, id }) => {
  if (isAdminUser(req.user)) return true
  if (!req.user) return false
  const lock = id === undefined ? null : await lockByID(req, id)
  const target = lock ? targetOf(lock) : (req.context[LOCK_SCOPE] as LockTarget | undefined)
  return target ? (await mayEditTarget(req, target)) && targetWhere(target) : false
}

/** Payload generates this hidden collection while sanitizing config. */
export const withLockRules = (config: SanitizedConfig): SanitizedConfig => {
  const locks = config.collections.find(({ slug }) => slug === collection)
  if (locks) {
    locks.access.create = lockInCallersNameOnEditableTarget
    locks.access.read = readLocksOnEditableTarget
    locks.access.update = takeOverEditableTargetLock
    locks.access.delete = releaseOwnEditableTargetLock
    locks.hooks.beforeOperation = [...(locks.hooks.beforeOperation ?? []), scopeLockLookup]
  }
  return config
}

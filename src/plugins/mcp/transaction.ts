import { commitTransaction, initTransaction, killTransaction, type PayloadRequest } from 'payload'

/**
 * Runs several writes as one: all of them land, or none does. A draft made in
 * English and then updated in Arabic must not be left half done, because a
 * retry would then make a second draft.
 */
export const inTransaction = async <T>(req: PayloadRequest, work: () => Promise<T>): Promise<T> => {
  const owner = await initTransaction(req)
  try {
    const result = await work()
    if (owner) await commitTransaction(req)
    return result
  } catch (error) {
    if (owner) await killTransaction(req)
    throw error
  }
}

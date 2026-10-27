import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  revalidate: vi.fn(),
  redirect: vi.fn(() => {
    throw new Error('redirect')
  }),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }))
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }))
vi.mock('@/lib/reader', () => ({
  currentReader: vi.fn(async () => ({ collection: 'users', id: 1 })),
}))
vi.mock('@/lib/spaces-write', () => ({ postRemove: mocks.remove }))

import { postRemoveAction } from '@/app/(frontend)/[locale]/spaces/actions'

const remove = (pathname: string) => {
  const form = new FormData()
  form.set('post', '42')
  form.set('pathname', pathname)
  return postRemoveAction({ status: 'ok' }, form)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.remove.mockResolvedValue({ ok: true, data: true })
})

describe('deleting an open post', () => {
  it.each(['en/spaces/community/3', 'ar/spaces/course/my-course', 'en/spaces/cohort/autumn'])(
    'revalidates and redirects to /%s instead of rendering the missing post',
    async (feed) => {
      await expect(remove(`/${feed}/posts/42`)).rejects.toThrow('redirect')
      expect(mocks.revalidate).toHaveBeenCalled()
      expect(mocks.redirect).toHaveBeenCalledWith(`/${feed}`, 'replace')
    },
  )

  it.each([
    '/en/spaces/community/3',
    '//evil.com/spaces/course/x/posts/42',
    '/en/spaces/course/x/posts/99',
  ])('does not redirect from an unrelated path: %s', async (path) => {
    await expect(remove(path)).resolves.toEqual({ status: 'ok' })
    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('leaves the post open when deletion fails', async () => {
    mocks.remove.mockResolvedValue({ ok: false, error: 'not-yours' })
    await expect(remove('/en/spaces/community/3/posts/42')).resolves.toEqual({
      status: 'error',
      error: 'not-yours',
    })
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(mocks.revalidate).not.toHaveBeenCalled()
  })
})

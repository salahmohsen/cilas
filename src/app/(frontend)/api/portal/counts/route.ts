import { currentReader } from '@/lib/reader'
import { needsCounts } from '@/portal/needs/needs'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET() {
  const user = await currentReader()
  if (!user) return new Response('Sign in first.', { status: 401, headers })
  return Response.json(await needsCounts(user), { headers })
}

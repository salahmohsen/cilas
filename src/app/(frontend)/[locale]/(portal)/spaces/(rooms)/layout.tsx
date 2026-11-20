import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { spacesOff } from '@/lib/spaces'

type Props = { children: React.ReactNode; dialog: React.ReactNode }

/**
 * Every space page and post dialog. Off: each is not found (spec §10), a
 * refusal, not a detour. No loading boundary sits above this check, so the
 * not-found answers 404 rather than a streamed 200.
 */
export default async function RoomsLayout({ children, dialog }: Props) {
  if (await spacesOff(await getPayload({ config }))) notFound()
  return (
    <>
      {children}
      {dialog}
    </>
  )
}

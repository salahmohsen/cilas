import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/lib/account-path'
import { currentReader } from '@/lib/reader'

type Props = { params: Promise<{ locale: string }> }

/** The old address of the profile: the first group of the account page. */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  const target = `/${locale}${ACCOUNT_PATH}`
  if (!(await currentReader())) {
    redirect(`/${locale}/login?next=${encodeURIComponent(target)}`)
  }
  redirect(`${target}#profile`)
}

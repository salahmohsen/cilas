import { redirect } from 'next/navigation'

import { ACCOUNT_PATH } from '@/lib/account-path'
import { currentReader } from '@/lib/reader'

type Props = { params: Promise<{ locale: string }> }

/**
 * The old address of the account page. Email links still point here: it keeps
 * the account as the target through a login. Both targets come from the
 * locale and a constant, never from the query.
 */
export default async function SettingsPage({ params }: Props) {
  const { locale } = await params
  const target = `/${locale}${ACCOUNT_PATH}`
  if (!(await currentReader())) {
    redirect(`/${locale}/login?next=${encodeURIComponent(target)}`)
  }
  redirect(target)
}

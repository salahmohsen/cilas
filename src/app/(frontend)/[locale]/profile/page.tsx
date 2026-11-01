import { redirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

/** The profile is the first section of the settings page (src/app/(frontend)/[locale]/settings). */
export default async function ProfilePage({ params }: Props) {
  const { locale } = await params
  redirect(`/${locale}/settings#profile`)
}

import { permanentRedirect } from 'next/navigation'

type Props = { params: Promise<{ locale: string }> }

/**
 * The About page is gone: the home page and its questions say what CILAS
 * is, and the footer gives the address. Old links land on the home page.
 */
export default async function AboutPage({ params }: Props) {
  const { locale } = await params
  permanentRedirect(`/${locale}`)
}

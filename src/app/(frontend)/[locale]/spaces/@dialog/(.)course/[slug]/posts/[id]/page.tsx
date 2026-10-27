import { PostDialogPage } from '@/components/space/post-dialog-page'

type Props = { params: Promise<{ locale: string; slug: string; id: string }> }

export default async function Page({ params }: Props) {
  return <PostDialogPage params={Promise.resolve({ ...(await params), kind: 'course' })} />
}

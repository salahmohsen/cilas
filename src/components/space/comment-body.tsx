import { PostBody } from '@/components/space/post-body'

type CommentBodyProps = {
  body: string
  people?: Record<number, string>
  peopleLinks?: Record<number, string | null>
}

export function CommentBody({ body, people = {}, peopleLinks = {} }: CommentBodyProps) {
  return <PostBody body={body} people={people} peopleLinks={peopleLinks} />
}

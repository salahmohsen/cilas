import { commentPieces } from '@/lib/comment-mentions'

/**
 * Comments are plain text (spec §4): line breaks kept, no Markdown, and
 * mentions as chips with the person's current name.
 */
export function CommentBody({
  body,
  people = {},
}: {
  body: string
  /** person id → current name */
  people?: Record<number, string>
}) {
  return (
    <p dir="auto" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
      {commentPieces(body).map((piece, i) =>
        'text' in piece ? (
          piece.text
        ) : (
          <span key={i} className="mention-chip" dir="auto">
            @{people[piece.person] ?? piece.name}
          </span>
        ),
      )}
    </p>
  )
}

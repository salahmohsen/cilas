'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Paperclip } from 'lucide-react'

import {
  CommentThread,
  type CommentAuthor,
  type CommentThreadEvent,
  type ThreadComment as ArcComment,
  matchMentions,
} from '@/components/arc/comment-thread/comment-thread'
import {
  commentCreateAction,
  commentEditAction,
  commentRemoveAction,
  reactionToggleAction,
  type SpacesWriteState,
} from '@/app/(frontend)/[locale]/spaces/actions'
import type { NoticePart } from '@/lib/space-consent'
import { REACTION_KINDS, type ReactionKind } from '@/lib/space-reactions'
import { FILE_LIMITS, SPACE_FILE_ACCEPT } from '@/lib/space-file-limits'
import type { SpaceFileRef, ThreadComment, TopComment } from '@/lib/spaces-data'

import { AttachmentTray } from './attachment-tray'
import { useAttachments } from './use-attachments'
import { Attachments } from './attachments'

import { LinkedText } from './linked-text'
import { saveErrorKey } from './composer'
import { ConsentSheet } from './consent-sheet'
import { PersonHover, type PersonCard } from './person-hover'
import { useRefreshPost } from './post-dialog-link'
import styles from './space.module.css'

const EMOJI: Record<ReactionKind, string> = {
  agree: '👍',
  thank_you: '❤️',
  celebrate: '🎉',
  insightful: '💡',
  same_question: '❓',
  rocket: '🚀',
}
const KIND_OF = new Map(REACTION_KINDS.map((k) => [EMOJI[k], k]))
const STORED_MENTION = /\[@([^\]]*)\]\(\/people\/(\d+)\)/g

/** In the feed, a long thread opens on its newest comments. */
const PREVIEW = 2

export type ThreadViewer = {
  personId: number | null
  moderator: boolean
  me: { name: string; photo: string | null }
}

/**
 * A post's comments (spec §4), drawn by Arc's comment thread. Replies go one
 * level under a comment (maxDepth 1, the same rule commentCreate enforces);
 * a deleted comment with replies stays as a placeholder (spec §3). The
 * privacy notice comes before a member's first comment (spec §9).
 */
export function SpaceThread({
  post,
  comments,
  people,
  viewer,
  canComment,
  consented,
  notice,
  now,
  titles,
  preview = false,
  limit,
  step,
  focusKey,
}: {
  post: number
  comments: TopComment[]
  /** Everyone in the space, for names, cards and @mentions */
  people: PersonCard[]
  viewer: ThreadViewer
  /** Open, unlocked, not archived, and the posting level lets this member comment */
  canComment: boolean
  consented: boolean
  notice: NoticePart[]
  /** When the page rendered, so times read the same on server and client */
  now: string
  /** Page titles by address, for the bare links in comment text */
  titles: Record<string, string>
  /** Opens on the newest comments, with a button for the rest */
  preview?: boolean
  /** How many top-level comments show first; defaults to 2 in a preview and all otherwise */
  limit?: number
  /** How many more each "Show more" adds; without it one press shows them all */
  step?: number
  focusKey?: number
}) {
  const t = useTranslations('SpaceThread')
  const tp = useTranslations('SpacePost')
  const tf = useTranslations('SpacePhotos')
  const format = useFormatter()
  const router = useRouter()
  const refreshPost = useRefreshPost()
  const [, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(limit ?? (preview ? PREVIEW : Infinity))
  const [accepted, setAccepted] = useState(consented)
  const [asking, setAsking] = useState<CommentThreadEvent | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const attachments = useAttachments(FILE_LIMITS.comment, setError)
  const { files } = attachments

  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const me: CommentAuthor = {
    id: String(viewer.personId ?? 'me'),
    name: viewer.me.name,
    avatar: viewer.me.photo ?? undefined,
  }
  const authors: CommentAuthor[] = useMemo(
    () => people.map((p) => ({ id: String(p.id), name: p.name, avatar: p.photo ?? undefined })),
    [people],
  )

  const filesOf = new Map<string, SpaceFileRef[]>()
  const toArc = (c: ThreadComment, replies?: ThreadComment[]): ArcComment => {
    if (c.files.length) filesOf.set(String(c.id), c.files)
    const person = c.authorId != null ? byId.get(c.authorId) : undefined
    return {
      id: String(c.id),
      author: {
        id: String(c.authorId ?? `gone-${c.id}`),
        name: person?.name ?? t('formerMember'),
        avatar: person?.photo ?? undefined,
      },
      // Stored mentions read as "@Name", with the person's current name; the ids stay beside the text.
      body: c.body.replace(
        STORED_MENTION,
        (_, name: string, id: string) => `@${byId.get(Number(id))?.name ?? name}`,
      ),
      mentions: [...c.body.matchAll(STORED_MENTION)].map(([, name, id]) => {
        const person = byId.get(Number(id))
        return { id: id!, name: person?.name ?? name!, avatar: person?.photo ?? undefined }
      }),
      createdAt: format.relativeTime(new Date(c.createdAt), new Date(now)),
      edited: c.edited,
      deleted: c.deleted,
      reactions: REACTION_KINDS.filter((k) => (c.reactions.counts[k] ?? 0) > 0).map((k) => {
        const count = c.reactions.counts[k] ?? 0
        const mine = c.reactions.mine.includes(k)
        // Arc counts people; the space keeps names private, so the others are placeholders.
        const others = Array.from({ length: count - (mine ? 1 : 0) }, (_, i) => `${k}-${i}`)
        return { emoji: EMOJI[k], users: mine ? [me.id, ...others] : others }
      }),
      replies: replies?.map((r) => toArc(r)),
    }
  }
  const server = comments.map((c) => toArc(c, c.replies))
  const [tree, setTree] = useState(server)
  const [seen, setSeen] = useState(comments)
  if (seen !== comments) {
    setSeen(comments)
    setTree(server)
  }

  /**
   * Each "@Name" becomes the stored link again, by the id picked in the
   * composer. A name nobody picked links only when one member has it.
   */
  const toStored = (text: string, mentions: CommentAuthor[]) => {
    let out = ''
    let from = 0
    for (const { start, end, person } of matchMentions(text, mentions, authors)) {
      const sameName = authors.filter((a) => a.name === person.name).length
      if (!mentions.includes(person) && sameName > 1) continue
      out += `${text.slice(from, start)}[@${person.name.replace(/[[\]]/g, '')}](/people/${person.id})`
      from = end
    }
    return out + text.slice(from)
  }

  const send = (event: CommentThreadEvent) => {
    const form = new FormData()
    let action = commentCreateAction
    switch (event.type) {
      case 'reply': {
        const tooLarge = attachments.problem()
        if (tooLarge) {
          setTree(server)
          return setError(tooLarge)
        }
        form.set('post', String(post))
        if (event.parentId) form.set('parent', event.parentId)
        form.set('body', toStored(event.comment.body, event.comment.mentions ?? []))
        for (const f of files) form.append('file', f)
        break
      }
      case 'edit':
        action = commentEditAction
        form.set('comment', event.id)
        form.set('body', toStored(event.body, event.mentions))
        break
      case 'delete':
        action = commentRemoveAction
        form.set('comment', event.id)
        break
      case 'react': {
        const kind = KIND_OF.get(event.emoji)
        if (!kind) return
        action = reactionToggleAction
        form.set('comment', event.id)
        form.set('reaction', kind)
        form.set('on', String(event.added))
        break
      }
    }
    start(async () => {
      const result = await action({ status: 'ok' }, form).catch((): SpacesWriteState => ({
        status: 'error',
        error: 'failed',
      }))
      if (result.status === 'error') {
        setTree(server)
        setError(tp(saveErrorKey(result.error)))
        return
      }
      if (event.type === 'reply') attachments.clear()
      router.refresh()
      refreshPost?.()
    })
  }

  const hidden = tree.slice(0, Math.max(0, tree.length - visible))
  const shown = tree.slice(hidden.length)
  // The real number of comments behind the button: replies count, a deleted placeholder does not.
  const countOf = (list: ArcComment[]) =>
    list.reduce(
      (sum, c) => sum + (c.deleted ? 0 : 1) + (c.replies?.filter((r) => !r.deleted).length ?? 0),
      0,
    )
  const hiddenCount = countOf(hidden)
  const nextCount = step ? countOf(hidden.slice(-step)) : hiddenCount
  const mine = (c: ArcComment) => c.author.id === me.id && /^\d+$/.test(c.id)

  return (
    <div className={styles.threadWrap}>
      <CommentThread
        comments={shown}
        showHeader={!preview && limit == null}
        listHeader={
          hiddenCount > 0 ? (
            <button
              type="button"
              className={styles.earlier}
              onClick={() => setVisible((n) => (step ? n + step : Infinity))}
            >
              {step
                ? t('showMore', { count: nextCount })
                : t('showEarlier', { count: hiddenCount })}
            </button>
          ) : undefined
        }
        onCommentsChange={(next, event) => {
          setError(null)
          setTree([...hidden, ...next])
          if (event.type === 'reply' && !accepted) return setAsking(event)
          send(event)
        }}
        currentUser={me}
        people={authors}
        reactions={REACTION_KINDS.map((k) => EMOJI[k])}
        maxDepth={1}
        resolvable={false}
        canReply={canComment}
        canEdit={(c) => canComment && mine(c)}
        canDelete={(c) => /^\d+$/.test(c.id) && (mine(c) || viewer.moderator)}
        placeholder={t('placeholder')}
        nowLabel={t('now')}
        composerFocusKey={focusKey}
        renderName={(author) => {
          const person = byId.get(Number(author.id))
          return person ? (
            <PersonHover person={person}>
              <button type="button" className={styles.authorButton}>
                <bdi>{author.name}</bdi>
              </button>
            </PersonHover>
          ) : (
            <bdi>{author.name}</bdi>
          )
        }}
        renderMention={(author, text) => {
          const person = byId.get(Number(author.id))
          if (!person) return text
          const chip = person.href ? (
            <a href={person.href} className={styles.mentionLink}>
              <bdi>{text}</bdi>
            </a>
          ) : (
            <button type="button" className={styles.mentionLink}>
              <bdi>{text}</bdi>
            </button>
          )
          return <PersonHover person={person}>{chip}</PersonHover>
        }}
        renderText={(text) => <LinkedText text={text} titles={titles} />}
        renderExtra={(c) => {
          const attached = filesOf.get(c.id)
          return attached ? <Attachments files={attached} label={tp('files')} compact /> : null
        }}
        composerExtra={
          <>
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              accept={SPACE_FILE_ACCEPT}
              onChange={(e) => {
                const picked = [...(e.currentTarget.files ?? [])]
                e.currentTarget.value = ''
                void attachments.add(picked)
              }}
            />
            <button
              type="button"
              className={styles.attach}
              aria-label={tf('attach')}
              title={tf('attachLimit', { count: FILE_LIMITS.comment })}
              disabled={files.length >= FILE_LIMITS.comment || attachments.busy}
              onClick={() => picker.current?.click()}
            >
              <Paperclip size={15} aria-hidden="true" />
            </button>
          </>
        }
        composerAttachments={
          files.length ? <AttachmentTray files={files} onRemove={attachments.remove} /> : undefined
        }
        labels={{
          thread: t('thread'),
          commentCount: (count) => t('count', { count }),
          empty: t('empty'),
          reply: t('reply'),
          edit: t('edit'),
          delete: t('delete'),
          cancel: t('cancel'),
          send: t('send'),
          save: t('save'),
          editComment: t('editComment'),
          edited: t('edited'),
          deleteConfirm: t('deleteConfirm'),
          deletedText: t('deletedText'),
          deletedComment: t('deletedComment'),
          replyingTo: (name) => t('replyingTo', { name }),
          cancelReply: t('cancelReply'),
          showReplies: (count) => t('showReplies', { count }),
          hideReplies: t('hideReplies'),
          addReaction: t('addReaction'),
          closeReactions: t('closeReactions'),
          reactions: t('reactions'),
          reactWith: (emoji) => tp(`reaction_${KIND_OF.get(emoji) ?? 'agree'}`),
          reactionCount: (emoji, count, you) =>
            t('reactionCount', {
              reaction: tp(`reaction_${KIND_OF.get(emoji) ?? 'agree'}`),
              count,
              you: String(you),
            }),
          mentions: t('mentions'),
        }}
      />
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ConsentSheet
        open={asking != null}
        onOpenChange={(open) => {
          if (open) return
          setAsking(null)
          setTree(server)
        }}
        notice={notice}
        onAccepted={() => {
          setAccepted(true)
          const pending = asking
          setAsking(null)
          if (pending) send(pending)
        }}
      />
    </div>
  )
}

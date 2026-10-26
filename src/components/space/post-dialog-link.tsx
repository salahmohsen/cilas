'use client'

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'

import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import { postDialogAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

type PostDialogApi = {
  /** Open the dialog, at one of the post's photos when `photo` is set, and give focus back to `opener` on close */
  openAt: (photo: number | null, opener: HTMLElement) => void
}

const Api = createContext<PostDialogApi | null>(null)
const StartPhoto = createContext<number | null>(null)
const Refresh = createContext<(() => void) | null>(null)

/** Inside a post: open that post's dialog. Null outside one. */
export const usePostDialog = () => useContext(Api)

/** Inside the post dialog: the photo it opened at, or null when it opened from the date. */
export const useStartPhoto = () => useContext(StartPhoto)

/** Inside the post dialog: reload the post after a change, so a new comment gets its real id. */
export const useRefreshPost = () => useContext(Refresh)

/**
 * The dialog of one post, for its date link and its photos. In the feed the
 * address bar follows with a history entry, so Back closes the dialog and a
 * reload lands on the post page. On the post's own page the address is
 * already the post's, so the dialog opens over the page without one, and the
 * page reloads its thread on close in case a comment changed in the dialog.
 */
export function PostDialog({
  href,
  postId,
  photos,
  page = false,
  children,
}: {
  href: string
  postId: number
  /** The post has photos, so the dialog fills the screen with the photos beside the post */
  photos: boolean
  /** On the post's own page */
  page?: boolean
  children: ReactNode
}) {
  const t = useTranslations('SpacePost')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [start, setStart] = useState<number | null>(null)
  const [content, setContent] = useState<ReactNode>(null)
  const [failed, setFailed] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const pushed = useRef(false)
  // The dialog's exit renders with the last open props, so its handlers read the state from here.
  const isOpen = useRef(open)
  useEffect(() => {
    isOpen.current = open
  }, [open])

  const load = useCallback(async () => {
    try {
      const node = await postDialogAction(postId, href, locale)
      if (node) {
        setContent(node)
        setFailed(false)
      } else setFailed(true)
    } catch {
      setFailed(true)
    }
  }, [postId, href, locale])

  // Back closes the dialog and Forward reopens it, so the address and the screen agree.
  useEffect(() => {
    if (page) return
    const sync = () => {
      const here = window.location.pathname === new URL(href, window.location.origin).pathname
      pushed.current = here
      setOpen(here)
      if (here) {
        setStart(null)
        void load()
      }
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [href, load, page])

  const api = useMemo<PostDialogApi>(
    () => ({
      openAt: (photo, from) => {
        opener.current = from
        setStart(photo)
        setFailed(false)
        setOpen(true)
        if (!page && !pushed.current) {
          window.history.pushState(null, '', href)
          pushed.current = true
        }
        void load()
      },
    }),
    [href, load, page],
  )

  const change = (next: boolean) => {
    if (next) return
    if (pushed.current) window.history.back()
    else setOpen(false)
    if (page) router.refresh()
  }

  const status = (
    <div className={styles.dialogStatus} role="status">
      {failed ? (
        <p className={styles.meta}>{t('dialogFailed')}</p>
      ) : (
        <TextShimmer as="p" className={styles.meta}>
          {t('dialogLoading')}
        </TextShimmer>
      )}
    </div>
  )

  return (
    <Api.Provider value={api}>
      {children}
      <Dialog open={open} onOpenChange={change}>
        <DialogContent
          title={t('dialogTitle')}
          closeLabel={t('dialogClose')}
          bare
          aria-modal="true"
          className={photos ? styles.postDialogWide : styles.postDialog}
          onOpenAutoFocus={(event) => {
            if (start == null) return
            // The viewer takes focus so the arrow keys move between photos at once.
            event.preventDefault()
            const root = event.currentTarget as HTMLElement
            ;(root.querySelector<HTMLElement>('[data-photo-viewer]') ?? root).focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Radix also calls this when the focus scope remounts while the dialog stays open.
            if (!isOpen.current) opener.current?.focus()
          }}
        >
          <StartPhoto.Provider value={start}>
            <Refresh.Provider value={load}>
              {content ??
                (photos ? (
                  // The same split as the loaded post, so nothing moves when it arrives.
                  <div className={styles.dialogSplit}>
                    <div className={styles.dialogPhotos} />
                    {status}
                  </div>
                ) : (
                  status
                ))}
            </Refresh.Provider>
          </StartPhoto.Provider>
        </DialogContent>
      </Dialog>
    </Api.Provider>
  )
}

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** The post's own page: where a new tab, a copied link and a browser without scripts go */
  href: string
  children: ReactNode
}

/** A post's date as a link to its page. A plain click opens the post's dialog instead. */
export const PostDateLink = forwardRef<HTMLAnchorElement, Props>(function PostDateLink(
  { href, children, onClick, ...rest },
  ref,
) {
  const dialog = usePostDialog()

  const show = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      !dialog ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    dialog.openAt(null, event.currentTarget)
  }

  return (
    <a {...rest} ref={ref} href={href} className={styles.dateLink} onClick={show}>
      {children}
    </a>
  )
})

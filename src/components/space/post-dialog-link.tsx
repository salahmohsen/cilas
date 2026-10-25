'use client'

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useLocale, useTranslations } from 'next-intl'

import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { postDialogAction } from '@/app/(frontend)/[locale]/spaces/actions'

import styles from './space.module.css'

const Refresh = createContext<(() => void) | null>(null)

/** Inside the post dialog: reload the post after a change, so a new comment gets its real id. */
export const useRefreshPost = () => useContext(Refresh)

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  /** The post's own page: where a new tab, a copied link and a browser without scripts go */
  href: string
  postId: number
  /** The post has photos, so the dialog is wide with the photos beside the text */
  photos: boolean
  children: ReactNode
}

/**
 * A post's date as a link to its page. A plain click opens the post in a
 * dialog over the feed instead, and the address bar follows with a history
 * entry, so Back closes the dialog and a reload lands on the post page.
 */
export const PostDateLink = forwardRef<HTMLAnchorElement, Props>(function PostDateLink(
  { href, postId, photos, children, onClick, ...rest },
  ref,
) {
  const t = useTranslations('SpacePost')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState<ReactNode>(null)
  const [failed, setFailed] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const pushed = useRef(false)

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
    const sync = () => {
      const here = window.location.pathname === new URL(href, window.location.origin).pathname
      pushed.current = here
      setOpen(here)
      if (here) void load()
    }
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [href, load])

  const show = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    event.preventDefault()
    opener.current = event.currentTarget
    setFailed(false)
    setOpen(true)
    if (!pushed.current) {
      window.history.pushState(null, '', href)
      pushed.current = true
    }
    void load()
  }

  const change = (next: boolean) => {
    if (next) return
    if (pushed.current) window.history.back()
    else setOpen(false)
  }

  return (
    <>
      <a {...rest} ref={ref} href={href} className={styles.dateLink} onClick={show}>
        {children}
      </a>
      <Dialog open={open} onOpenChange={change}>
        <DialogContent
          title={t('dialogTitle')}
          className={photos ? styles.postDialogWide : styles.postDialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            opener.current?.focus()
          }}
        >
          <Refresh.Provider value={load}>
            {content ?? (
              <p className={styles.meta} role="status">
                {failed ? t('dialogFailed') : t('dialogLoading')}
              </p>
            )}
          </Refresh.Provider>
        </DialogContent>
      </Dialog>
    </>
  )
})

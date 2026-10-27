'use client'

import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import styles from './space.module.css'

type PostDialogApi = { openAt: (photo: number | null) => void }
const Api = createContext<PostDialogApi | null>(null)

export const usePostDialog = () => useContext(Api)

/** The photo selected in the feed; the URL also preserves it through Back/Forward. */
export function useStartPhoto() {
  const value = useSearchParams().get('photo')
  const photo = value === null ? null : Number(value)
  return photo !== null && Number.isInteger(photo) && photo >= 0 ? photo : null
}

/** Feed photos and date links navigate to the same intercepted post route. */
export function PostDialog({
  href,
  photos,
  children,
}: {
  href: string
  photos: boolean
  children: ReactNode
}) {
  const router = useRouter()
  const api = useMemo<PostDialogApi>(
    () => ({
      openAt: (photo) =>
        router.push(photos ? `${href}?photo=${photo ?? 0}` : href, { scroll: false }),
    }),
    [href, photos, router],
  )
  return <Api.Provider value={api}>{children}</Api.Provider>
}

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string
  children: ReactNode
}

export const PostDateLink = forwardRef<HTMLAnchorElement, Props>(function PostDateLink(
  { href, children, onClick, className, ...rest },
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
    dialog.openAt(null)
  }
  return (
    <a {...rest} ref={ref} href={href} className={className ?? styles.dateLink} onClick={show}>
      {children}
    </a>
  )
})

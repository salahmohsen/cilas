'use client'

import { useState, type ReactNode } from 'react'
import Image from 'next/image'

function ResultImage({ src, fallback }: { src: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false)
  return failed ? (
    fallback
  ) : (
    <Image
      width={48}
      height={48}
      sizes="48px"
      unoptimized={src.startsWith('/api/space-files/')}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="hidden size-12 shrink-0 rounded-xl object-cover ring-1 ring-black/10 md:block dark:ring-white/10"
    />
  )
}

/** Media lane and content alignment shared by public and private search rows. */
export function SearchResultContent({
  image,
  icon,
  leading,
  active = false,
  children,
}: {
  image?: string
  icon: ReactNode
  leading?: ReactNode
  active?: boolean
  children: ReactNode
}) {
  const fallback = (
    <span
      className={`hidden size-12 shrink-0 place-items-center rounded-xl text-muted-foreground md:grid ${active ? 'text-foreground' : ''}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  )
  return (
    <div className="flex items-start gap-3 md:gap-4" dir="auto">
      {leading ?? (image ? <ResultImage key={image} src={image} fallback={fallback} /> : fallback)}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

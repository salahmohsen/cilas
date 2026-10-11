'use client'

import { ThemeProvider as NextThemes } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Light, dark or the system's choice, kept in the visitor's browser and set
 * before first paint. It writes both `data-theme` (read by Arc's tokens) and
 * the `dark` class (read by shadcn and Tailwind's `dark:` variant).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes
      attribute={['data-theme', 'class']}
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="cilas-theme"
    >
      {children}
    </NextThemes>
  )
}

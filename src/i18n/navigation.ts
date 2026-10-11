import { createNavigation } from 'next-intl/navigation'

import { routing } from './routing'

/** Locale-aware Link and router: hrefs are written without the language. */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)

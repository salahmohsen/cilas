import type { MetadataRoute } from 'next'

import messages from '../../messages/en.json'

/**
 * Web app manifest for "Add to Home Screen" installs, served at
 * /manifest.webmanifest. One file for both languages, so the names are
 * English. Outside the locale routes: src/proxy.ts must not redirect it.
 *
 * start_url is the home page, which redirects to the visitor's language.
 * Spaces needs a sign-in, so it is a shortcut and not the start page: an
 * installed app that opened on a login form would be a dead end for visitors.
 */
// The icon background and the site's primary colour in the light theme.
const BRAND = '#18181b'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Cairo Institute of Liberal Arts and Sciences',
    short_name: 'CILAS',
    description: messages.Meta.description,
    lang: 'en',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BRAND,
    theme_color: BRAND,
    icons: [
      { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/assets/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Spaces',
        short_name: 'Spaces',
        url: '/spaces',
        icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Events',
        short_name: 'Events',
        url: '/events',
        icons: [{ src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}

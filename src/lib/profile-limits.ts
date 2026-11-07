/**
 * The limits the profile server (lib/profile) and the profile form both keep.
 * They sit apart from lib/profile because that file imports Payload and the
 * form runs in the browser.
 */

export const HTTP_URL = /^https?:\/\/\S+$/i
export const NAME_MAX = 120
export const LINKS_MAX = 8

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024

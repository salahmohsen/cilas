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
/**
 * Width times height of one frame. The largest image stored when this limit
 * was set was 24 MP (6000 x 4000), so no existing image is refused. A small
 * file can hold a huge canvas; sharp needs memory for every pixel.
 */
export const PHOTO_MAX_PIXELS = 50_000_000
export const PHOTO_FORMATS = 'JPEG, PNG or WebP'

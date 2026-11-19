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
 * Width times height times frames: what a non-admin's photo may hold in all.
 * An animated WebP counts every frame. The largest image stored when this
 * limit was set was 24 MP (6000 x 4000), so no existing image is refused.
 */
export const PHOTO_MAX_PIXELS = 50_000_000
/**
 * The most pixels, in all frames, that sharp decodes for any upload, an admin's
 * too. It protects server memory: a small file can hold a huge canvas, and a
 * 256 MP PNG took 1.3 GB and 7 s. It sits above PHOTO_MAX_PIXELS so an admin
 * can store an animation (an 800 x 600 GIF of 105 frames is 50 MP). No stored
 * image or animation is near it.
 */
export const IMAGE_DECODE_MAX_PIXELS = 100_000_000
export const PHOTO_FORMATS = 'JPEG, PNG or WebP'

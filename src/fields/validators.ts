/** Field validators. Each returns true or a message for the editor. */

export const httpUrl = (value: unknown): true | string =>
  typeof value === 'string' && /^https?:\/\/\S+$/.test(value)
    ? true
    : 'Enter a full URL starting with https:// or http://'

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const timeOfDay = (value: unknown): true | string =>
  typeof value === 'string' && TIME.test(value)
    ? true
    : 'Use 24-hour HH:MM in Cairo time, e.g. 19:00'

// Zero-padded HH:MM strings sort the same way as the times they name.
export const endAfterStart = (end: unknown, start: unknown): true | string =>
  typeof end !== 'string' || typeof start !== 'string' || !TIME.test(start) || end > start
    ? true
    : 'End time must be after the start time.'

export const notBelow = (value: unknown, floor: unknown, name: string): true | string =>
  typeof value !== 'number' || typeof floor !== 'number' || value >= floor
    ? true
    : `Must not be below ${name}.`

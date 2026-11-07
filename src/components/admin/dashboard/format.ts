/** How the dashboard widgets write numbers, days, counts and sizes. */

const numberFormat = new Intl.NumberFormat('en-US')
export const formatNumber = (value: number) => numberFormat.format(value)

const dayFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
/** A calendar day (YYYY-MM-DD) as "Mar 4, 2026". */
export const formatDay = (day: string) => dayFormat.format(new Date(`${day}T00:00:00Z`))

/** "1 draft", "3 drafts". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const MB = 1024 * 1024
/** Bytes as megabytes with one decimal place. */
export const megabytes = (bytes: number) => Math.round((bytes / MB) * 10) / 10

/** Keep user punctuation literal in the database's substring pattern. */
export const literalSubstring = (query: string): string => query.trim().replace(/[\\%_]/g, '\\$&')

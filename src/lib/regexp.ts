/** Text matched literally inside a RegExp. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

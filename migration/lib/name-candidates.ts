const fold = (name: string): string =>
  name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const distance = (a: string, b: string): number => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

const related = (a: string, b: string): boolean => {
  const fa = fold(a)
  const fb = fold(b)
  if (fa === fb) return true
  const [wa, wb] = [fa.split(' '), fb.split(' ')]
  if ((wa.length === 1 && wb[0] === wa[0]) || (wb.length === 1 && wa[0] === wb[0])) return true
  return wa.length > 1 && wb.length > 1 && wa[0] === wb[0] && distance(fa, fb) <= 2
}

/**
 * Names that may be one person, for an agent or a person to decide; distinct
 * spellings only, each group sorted, groups sorted by their first name.
 */
export const candidateGroups = (mentions: Array<{ name: string; where: string }>): string[][] => {
  // Code-point order, so the output is the same on every machine.
  const names = [...new Set(mentions.map((m) => m.name.trim()))].sort()
  const parent = new Map(names.map((n) => [n, n]))
  const find = (n: string): string => (parent.get(n) === n ? n : find(parent.get(n) as string))
  for (let i = 0; i < names.length; i++)
    for (let j = i + 1; j < names.length; j++) if (related(names[i], names[j])) parent.set(find(names[j]), find(names[i]))
  const groups = new Map<string, string[]>()
  for (const n of names) groups.set(find(n), [...(groups.get(find(n)) ?? []), n])
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
}

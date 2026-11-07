/** Collections whose owners submit work for review. */
export const REVIEWED = [
  { kind: 'article', collection: 'articles', owners: 'authors', roles: ['fellow', 'student'] },
  { kind: 'course', collection: 'courses', owners: 'fellows', roles: ['fellow'] },
  {
    kind: 'publication',
    collection: 'publications',
    owners: 'editors',
    roles: ['fellow', 'student'],
  },
] as const

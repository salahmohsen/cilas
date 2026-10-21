import type { SyllabusEntry, SyllabusGroup, SyllabusFeedProps } from './syllabus-feed'

/**
 * A sample syllabus, so the block installs alone and previews like itself.
 * Entries' bodies are plain nodes: on real course pages the caller renders
 * the session text (descriptions, reading lists, activities) server-side.
 */

const sampleGroups: SyllabusGroup[] = [
  { key: '2026-10', label: 'October 2026', short: 'Oct' },
  { key: '2026-11', label: 'November 2026', short: 'Nov' },
]

const session = (partial: Omit<SyllabusEntry, 'materials' | 'activities'> & Partial<Pick<SyllabusEntry, 'materials' | 'activities'>>): SyllabusEntry => ({
  materials: ['reading'],
  activities: ['discussion'],
  ...partial,
})

const sampleEntries: SyllabusEntry[] = [
  session({
    id: 'wk-1',
    month: '2026-10',
    no: '1',
    date: { label: 'Oct 12', iso: '2026-10-12' },
    title: 'Cities and their texts',
    meta: {
      unit: 'Week 1',
      meetings: [{ date: 'Mon 12 Oct', time: '18:00–20:00' }],
      extra: ['2 readings'],
    },
    activities: ['discussion'],
    materials: ['reading'],
    body: (
      <p>
        We begin with the city as something written: street names, posters, shop signage.
        A short reading accompanies the walk for next week.
      </p>
    ),
  }),
  session({
    id: 'wk-2',
    month: '2026-10',
    no: '2',
    date: { label: 'Oct 19', iso: '2026-10-19' },
    title: 'Drawing a street',
    meta: {
      meetings: [{ date: 'Mon 19 Oct', time: '18:00–20:00' }],
    },
    activities: ['exercise', 'screening'],
    materials: ['watch'],
    body: <p>A screening, then field notebooks out: one street, drawn twice, an hour apart.</p>,
  }),
  session({
    id: 'wk-3',
    month: '2026-10',
    no: '3',
    date: { label: 'Oct 26', iso: '2026-10-26' },
    title: 'Reading the archive',
    meta: {
      unit: 'Week 3',
      meetings: [{ date: 'Mon 26 Oct', time: '18:00–20:00' }],
      extra: ['3 readings'],
    },
    activities: ['discussion', 'presentation'],
    materials: ['reading', 'other'],
    body: <p>Municipal maps and photographs from 1940 to today, read against each other.</p>,
  }),
  session({
    id: 'wk-4',
    month: '2026-11',
    no: '4',
    date: { label: 'Nov 2', iso: '2026-11-02' },
    title: 'The field visit',
    meta: {
      unit: 'Week 4',
      meetings: [{ date: 'Mon 2 Nov', time: '10:00–14:00' }],
      extra: ['1 prompt'],
    },
    activities: ['field_visit'],
    materials: ['prompt'],
    body: <p>Half a day in the market district, against three prompts brought back together.</p>,
  }),
  session({
    id: 'wk-5',
    month: '2026-11',
    no: '5',
    date: { label: 'Nov 9', iso: '2026-11-09' },
    title: 'Workshop: building a poster',
    meta: {
      unit: 'Week 5',
      meetings: [{ date: 'Mon 9 Nov', time: '18:00–21:00' }],
    },
    activities: ['exercise'],
    materials: [],
    body: <p>Three hours at the tables; bring the drawings from week two.</p>,
  }),
]

export const defaultSyllabusProps: Pick<
  SyllabusFeedProps,
  'groups' | 'entries' | 'title' | 'subtitle' | 'endNote'
> = {
  groups: sampleGroups,
  entries: sampleEntries,
  title: 'Syllabus',
  subtitle: 'Six weeks, three cities in text',
  endNote: 'The course closes with the exhibition of the notebooks.',
}

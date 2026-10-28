import type { Block } from 'payload'

import { movieSnapshotSchema } from '@/lib/movie'
import { SUBTITLE_LANGUAGE_OPTIONS } from '@/lib/subtitle-languages'

export const Movie: Block = {
  slug: 'movie',
  interfaceName: 'MovieBlock',
  labels: { singular: 'Movie', plural: 'Movies' },
  fields: [
    {
      name: 'subtitleLanguages',
      label: 'Screening subtitle languages',
      type: 'select',
      hasMany: true,
      options: SUBTITLE_LANGUAGE_OPTIONS,
      admin: {
        description:
          'Select every subtitle language available at this screening. Leave empty if there are no subtitles.',
      },
    },
    {
      name: 'movie',
      type: 'json',
      required: true,
      validate: (value) =>
        movieSnapshotSchema.safeParse(value).success || 'Search for and select a movie.',
      admin: {
        components: { Field: '/components/admin/movie-picker#MoviePicker' },
        description:
          'Search by title, check the year, and select the movie. Its metadata is saved with this block.',
      },
    },
  ],
}

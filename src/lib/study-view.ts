/** The two ways the study list can show a page of courses. */
export const STUDY_VIEWS = ['list', 'grid'] as const
export type StudyView = (typeof STUDY_VIEWS)[number]

/** The `view` search param. It only changes how a page looks, never which courses it holds. */
export const STUDY_VIEW_PARAM = 'view'

/** The list is the default: only `?view=grid` asks for the grid. */
export const readStudyView = (params: { get(name: string): string | null }): StudyView =>
  params.get(STUDY_VIEW_PARAM) === 'grid' ? 'grid' : 'list'

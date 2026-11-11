export type CourseFellows = { id: number; title: string; fellowUsers: number[] }

/**
 * Who hears about an application besides the admins: each covered course's
 * fellows. Admins already get the full note, so a fellow who is also an admin
 * is left out here. A fellow of two chosen courses is listed under both, so
 * each note names one course and never another.
 */
export const fellowNoticesFor = (
  adminIds: number[],
  courses: CourseFellows[],
): Array<{ course: CourseFellows; users: number[] }> => {
  const admins = new Set(adminIds)
  return courses
    .map((course) => ({
      course,
      users: [...new Set(course.fellowUsers)].filter((id) => !admins.has(id)),
    }))
    .filter((notice) => notice.users.length > 0)
}

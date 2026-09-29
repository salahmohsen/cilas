import { getPublicPosts } from '@/api/courses.api'
import { getPayload } from 'payload'
import config from '@payload-config'

export default async function CoursesPage() {
  const payload = await getPayload({ config })
  const courses = await getPublicPosts(payload)

  console.log('courses', courses)

  return <div>{JSON.stringify(courses)}</div>
}

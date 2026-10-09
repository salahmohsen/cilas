import { HoverExpand } from '@/components/unlumen-ui/hover-expand'
import { getPublicPosts } from '@/api/courses.api'
import { convertLexicalToPlaintext } from '@payloadcms/richtext-lexical/plaintext'
import config from '@payload-config'
import { getPayload } from 'payload'
import Image from 'next/image'
import { StudyFilters } from '@/components/study-filters'

export default async function CoursesPage() {
  const payload = await getPayload({ config })
  const { docs: courses } = await getPublicPosts(payload)

  const items = courses.map((course) => {
    const cover = course.cover_image

    return {
      label: course.title,
      href: `/study/${course.slug}`,
      sublabel: course.subtitle ?? undefined,
      description: course.description
        ? convertLexicalToPlaintext({ data: course.description })
        : undefined,
      image: typeof cover === 'object' ? (cover?.url ?? undefined) : undefined,
      imageAlt: typeof cover === 'object' ? (cover?.alt ?? undefined) : undefined,
    }
  })

  return (
    <div className="flex flex-col gap-8">
      <div className="relative h-96 w-full">
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50 px-8 text-center">
          <p className="text-2xl font-bold text-white leading-tight">
            What we cover at CILAS matters less than what a student discovers.
          </p>
          <p className="text-white/80 mt-4 text-lg max-w-2xl mx-auto">
            — A pedagogy of discovery and attunement, not consumption
          </p>
        </div>
        <Image
          src="/assets/images/cilas-classroom.jpg"
          alt="CILAS Classroom"
          width={1000}
          height={1000}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
      <StudyFilters />
      <HoverExpand items={items} />
    </div>
  )
}

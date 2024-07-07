import { Course } from "@/components/client/page.courses/page.courses";
import { CoursePagination } from "@/components/client/page.courses/page.courses.pagination";
import { Sidebar } from "@/components/client/page.courses/pages.courses.sidebar";
import { getSafeCourses } from "@/actions/courses.actions";
import slug from "slug";

const CoursesPage = async () => {
  const data = await getSafeCourses("published");
  if (data.error === false)
    return (
      <section className="grid h-screen grid-cols-10 gap-5">
        <div className="relative col-span-10 mb-10 md:col-span-8">
          {data.safeCourses?.map((course) => {
            return (
              <Course
                key={course.id}
                titleSlug={`${slug(course.enTitle)}-${course.id}`}
                course={course}
              />
            );
          })}
          <CoursePagination />
        </div>
        <div className="col-span-2 hidden md:block">
          <Sidebar />
        </div>
      </section>
    );
};

export default CoursesPage;

import { fetchPublicCourses } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import slug from "slug";
import { Course } from "../_components/courses/courses";
import { CoursePagination } from "../_components/courses/pagination";
import { Sidebar } from "../_components/courses/sidebar/sidebar";

const CoursesPage = async () => {
  const data = await fetchPublicCourses({});
  if (data.success)
    return (
      <section className="grid h-screen grid-cols-10 gap-5">
        <div className="relative col-span-10 mb-10 md:col-span-8">
          {data.data?.map((course) => {
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

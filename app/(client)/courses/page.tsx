import Course from "@/components/client/Course";
import CoursePagination from "@/components/client/CoursePagination";
import Sidebar from "@/components/client/Sidebar";
import { getCourses } from "@/actions/courses.actions";
import slug from "slug";

const CoursesPage = async () => {
  const coursesData = await getCourses("all published");
  return (
    <section className="grid h-screen grid-cols-10 gap-5">
      <div className="relative col-span-10 mb-10 md:col-span-8">
        {coursesData.map((course) => {
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

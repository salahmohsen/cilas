import Sidebar from "@/components/courses/sidebar/sidebar.jsx";
import Course from "@/components/courses/course/course.jsx";
import CoursePagination from "@/components/courses/course/coursePagination.jsx";
import { dummy_courses } from "@/dummydb/dummydata";
import { getCourses } from "@/actions/coursesActions";
const page = async () => {
  const coursesData = await getCourses();
  return (
    <section className="grid h-screen grid-cols-10  gap-5 ">
      <div className=" relative col-span-10 mb-10 md:col-span-8">
        {coursesData.map((course) => (
          <Course key={course.id} {...course} />
        ))}
        <CoursePagination />
      </div>
      <div className="col-span-2 hidden md:block">
        <Sidebar />
      </div>
    </section>
  );
};

export default page;

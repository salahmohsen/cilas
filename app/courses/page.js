import Sidebar from "../../components/courses/sidebar/sidebar";
import Course from "../../components/courses/course.jsx";
import CoursePagination from "../../components/courses/coursePagination";
import { dummy_courses } from "@/db/dummydata.js";

const page = () => {
  return (
    <section className="grid h-screen grid-cols-10  gap-5 ">
      <div className=" relative col-span-10 mb-10 md:col-span-8">
        {dummy_courses.map((course) => (
          <Course key={course.id} {...course} isSlug={false} />
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

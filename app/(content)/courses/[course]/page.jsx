import { dummy_courses } from "@/dummydb/dummydata";
import Course from "@/components/courses/course/course.jsx";

const page = ({ params }) => {
  const titleSlug = params.course;
  const course = dummy_courses.find((course) => course.titleSlug === titleSlug);
  return <Course {...course} isOpen={true} />;
};

export default page;

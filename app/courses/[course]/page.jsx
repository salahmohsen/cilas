import { dummy_courses } from "@/db/dummydata";
import Course from "@/components/courses/course";

const page = ({ params }) => {
  const titleSlug = params.course;
  const course = dummy_courses.find((course) => course.titleSlug === titleSlug);
  return <Course {...course} />;
};

export default page;

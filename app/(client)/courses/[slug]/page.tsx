import { getPublicCourseById } from "@/lib/actions/courses.actions";
import { Course } from "../../_components/courses/courses";

const page = async ({ params }) => {
  const { slug } = params;
  const courseId = slug.split("-").slice(-1)[0];
  const course = await getPublicCourseById(courseId);
  if (!course) return <p>Couldn`&apos;t fetching course</p>;
  return <Course isOpen={true} course={course} />;
};

export default page;

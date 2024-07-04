import { getCourseById } from "@/actions/courses.actions";
import Course from "@/components/client/page.courses/page.courses";

const page = async ({ params }) => {
  const { slug } = params;
  const courseId = slug.split("-").slice(-1)[0];
  const course = await getCourseById(courseId);
  if (!course) return <p>Couldn`&apos;t fetching course</p>;
  return <Course isOpen={true} course={course} />;
};

export default page;

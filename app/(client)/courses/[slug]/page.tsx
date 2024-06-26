import { getCourseById } from "@/actions/courses.actions";
import Course from "@/components/client/Course";

const page = async ({ params }) => {
  const { slug } = params;
  const courseId = slug.split("-").slice(-1)[0];
  const course = await getCourseById(courseId);
  if (!course) return <p>Couldn`&apos;t fetching course</p>;
  return <Course isOpen={true} {...course} />;
};

export default page;

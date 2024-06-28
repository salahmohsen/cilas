import { getCourseById } from "@/actions/courses.actions";
import Course from "@/components/client/Course";

const page = async ({ params }) => {
  const { slug } = params;
  const slugId = slug.split("-").slice(-1)[0];
  const { course, user } = await getCourseById(slugId);
  return <Course course={course} user={user} isOpen={true} />;
};

export default page;

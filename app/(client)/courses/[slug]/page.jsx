import { getCourseById } from "@/actions/CoursesActions";
import Course from "@/components/client/Course";

const page = async ({ params }) => {
  const { slug } = params;
  const slugId = slug.split("-").slice(-1)[0];
  const courseData = await getCourseById(slugId);
  return <Course {...courseData} isOpen={true} />;
};

export default page;

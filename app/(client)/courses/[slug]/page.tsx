import { fetchPublicCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { Course } from "../../_components/courses/courses";

const page = async ({ params }) => {
  const { slug } = params;
  const courseId = slug.split("-").slice(-1)[0];
  const { data } = await fetchPublicCourse(courseId);
  if (!data) return <p>Couldn`&apos;t fetching course</p>;
  return <Course isOpen={true} course={data} />;
};

export default page;

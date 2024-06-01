import { getCourse } from "@/actions/clientActions";
import Course from "@/components/client/Course";

const page = async ({ params }) => {
  const { slug } = params;
  const slugId = slug.split("-").slice(-1)[0];
  const { ...course } = await getCourse(slugId);
  return <Course {...course[0]} isOpen={true} />;
};

export default page;

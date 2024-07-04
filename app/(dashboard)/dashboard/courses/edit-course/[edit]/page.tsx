import { getCourseById } from "@/actions/courses.actions";
import CourseForm from "@/components/dashboard/form.course/form.course";
import { ErrorPage } from "@/components/ui/error";
import { CourseWithFellow } from "@/types/drizzle.types";

export default async function EditCoursePage({ params }) {
  let courseId: number;
  let course: CourseWithFellow | undefined;

  try {
    const parts = params.edit?.split("-");
    courseId = Number(parts[parts.length - 1]);

    if (!courseId || isNaN(courseId)) throw new Error("course id is wrong!");

    course = await getCourseById(courseId);

    if (!course) throw new Error("Course not found!");

    return (
      <CourseForm editMode={true} courseData={course} courseId={courseId} />
    );
  } catch (error) {
    if (error instanceof Error) {
      return <ErrorPage message={error.message} />;
    }
  }
}

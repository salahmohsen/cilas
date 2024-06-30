import { getCourseById } from "@/actions/courses.actions";
import CourseForm from "@/components/dashboard/courseForm/CourseForm";
import { courseSchema } from "@/types/courseForm.schema";
import { z } from "zod";
import { ErrorPage } from "@/components/ui/error";
import { User } from "@/types/drizzle.types";

export default async function EditCoursePage({ params }) {
  let courseId: number;
  let course:
    | ((z.infer<typeof courseSchema> & { draftMode: boolean }) & {
        author: User;
      })
    | undefined;

  try {
    const parts = params.edit?.split("-");
    courseId = Number(parts[parts.length - 1]);
    if (!courseId || isNaN(courseId)) throw new Error("course id is wrong!");
    course = await getCourseById(courseId);

    if (!course) throw new Error("Course not found!");
  } catch (error) {
    if (error instanceof Error) {
      return <ErrorPage message={error.message} />;
    } else return;
  }

  return <CourseForm editMode={true} courseData={course} courseId={courseId} />;
}

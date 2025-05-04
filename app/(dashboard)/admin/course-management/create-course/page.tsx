import { fetchPrivateCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { ErrorPage } from "@/components/ui/error";
import { Suspense } from "react";
import { CourseEditor } from "../_components/courses/editor/course.editor";
import { PrivateCourse } from "../_lib/courses.actions.types";
import Loading from "./loading";

export default async function CreateCoursePage({
  searchParams,
}: {
  searchParams: { duplicate?: string };
}) {
  const slug = searchParams?.duplicate;

  let course: PrivateCourse | null = null;
  let error: string | undefined = undefined;

  if (slug) {
    try {
      const { data: courseData } = await fetchPrivateCourse({ slug });

      if (!courseData) {
        throw new Error(
          "The course you're trying to copy it's values does not exist or cannot be found. Please try again.",
        );
      }

      course = courseData;
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    }
  }

  if (error) {
    return <ErrorPage message={error} />;
  }

  if (slug) {
    if (!course) {
      return <Loading />;
    }

    return <CourseEditor courseData={course} />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <CourseEditor />
    </Suspense>
  );
}

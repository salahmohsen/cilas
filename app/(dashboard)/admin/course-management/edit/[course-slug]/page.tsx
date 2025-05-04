import { fetchPrivateCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { ErrorPage } from "@/components/ui/error";
import { Suspense } from "react";
import { CourseEditor } from "../../_components/courses/editor/course.editor";
import Loading from "../../loading";

export default async function EditCoursePage({
  params,
}: {
  params: { "course-slug": string };
}) {
  const slug = params["course-slug"];

  if (!slug) {
    return <ErrorPage message="No course Found!" />;
  }

  try {
    // Fetch course data server-side
    const courseResult = await fetchPrivateCourse({ slug });
    const courseData = courseResult.data;

    if (!courseData) {
      return <ErrorPage message="Course not found!" />;
    }

    return (
      <Suspense fallback={<Loading />}>
        <CourseEditor
          editMode={true}
          courseData={courseData}
          courseId={Number(courseData.id)}
        />
      </Suspense>
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return <ErrorPage message={errorMessage} />;
  }
}

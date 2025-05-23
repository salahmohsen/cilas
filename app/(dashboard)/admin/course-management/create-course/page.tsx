"use client";

import { getCourseWithEnrollmentsById } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { ErrorPage } from "@/components/ui/error";
import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CourseEditor } from "../_components/courses/editor/course.editor";
import Loading from "./loading";

export default function CreateCoursePage() {
  const [course, setCourse] = useState<CourseWithFellowAndStudents | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const searchParams = useSearchParams();
  const courseId = searchParams?.get("duplicate-course");

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    const errorMessage = `The course you're trying to copy it's values does not exist or cannot be found. Please check the course ID and try again.`;
    setLoading(true);
    try {
      const id = Number(courseId);
      if (isNaN(id)) {
        throw new Error(errorMessage);
      }
      const courseData = await getCourseWithEnrollmentsById(id);
      if (!courseData) {
        throw new Error(errorMessage);
      }

      setCourse(courseData);
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (courseId) {
    if (error) return <ErrorPage message={error} />;

    if (course) {
      return (
        <CourseEditor
          courseData={{
            ...course,
            startDate: new Date(course?.startDate),
            endDate: new Date(course?.endDate),
          }}
        />
      );
    }
    return <Loading />;
  }

  // If there's no courseId, render the form without course data
  return (
    <Suspense fallback={<Loading />}>
      <CourseEditor />
    </Suspense>
  );
}

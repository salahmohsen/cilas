"use client";

import { ErrorPage } from "@/components/ui/error";
import { getCourseById } from "@/lib/actions/courses.actions";
import { CourseWithFellow } from "@/lib/types/drizzle.types";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CourseForm } from "../_components/courses/editor/course.editor";
import Loading from "../create-course/loading";

export default function EditCoursePage() {
  const searchParam = useSearchParams();
  const courseId = searchParam?.get("id");
  let courseValues = useRef<CourseWithFellow | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    try {
      setIsLoading(true);
      if (!courseId || !Number(courseId))
        throw new Error("course id is wrong!");
      courseValues.current = await getCourseById(Number(courseId));
      if (!courseValues.current) throw new Error("Course not found!");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (courseId && isLoading) return <Loading />;
  if (error && !isLoading) return <ErrorPage message={error} />;
  if (courseId && !isLoading)
    return (
      <CourseForm
        editMode={true}
        courseData={courseValues.current}
        courseId={Number(courseId)}
      />
    );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { CourseForm } from "@/components/dashboard/form/form.course";
import { getCourseById } from "@/actions/courses.actions";
import { ErrorPage } from "@/components/ui/error";
import { CourseWithFellow } from "@/types/drizzle.types";
import { useSearchParams } from "next/navigation";

export default function CreateCoursePage() {
  const [course, setCourse] = useState<CourseWithFellow | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  const searchParams = useSearchParams();
  const courseId = searchParams.get("copy_values");

  const fetchCourse = useCallback(async () => {
    if (!courseId) return;
    const errorMessage = `The course you're trying to copy it's values does not exist or cannot be found. Please check the course ID and try again.`;
    setLoading(true);
    try {
      const id = Number(courseId);
      if (isNaN(id)) {
        throw new Error(errorMessage);
      }
      const courseData = await getCourseById(id);
      if (!courseData) {
        throw new Error(errorMessage);
      }

      setCourse(courseData);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  if (courseId) {
    if (loading) {
      return (
        <p className="flex h-screen items-center justify-center text-4xl">
          Loading...
        </p>
      );
    }
    if (error) {
      return <ErrorPage message={error} />;
    }
    if (course) {
      return (
        <CourseForm
          courseData={{
            ...course,
            startDate: new Date(course?.startDate),
            endDate: new Date(course?.endDate),
          }}
        />
      );
    }
    // This case handles when courseId exists but course data is not yet loaded
    return (
      <p className="flex h-screen items-center justify-center text-4xl">
        Loading...
      </p>
    ); // To-Do Change this to courseFormSkeleton when created
  }

  // If there's no courseId, render the form without course data
  return <CourseForm />;
}

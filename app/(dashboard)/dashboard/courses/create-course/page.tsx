"use client";

import { getCourseById } from "@/actions/courses.actions";
import CourseForm from "@/components/dashboard/courseForm/CourseForm";
import { courseSchema } from "@/types/courseForm.schema";
import { CourseWithAuthor } from "@/types/drizzle.types";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";

export default function CreateCoursePage() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("duplicate");
  const [course, setCourse] = useState<
    z.infer<typeof courseSchema> | undefined
  >(undefined);

  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const courseData = await getCourseById(Number(courseId));
        setCourse(courseData);
      } catch (error) {
        if (error instanceof Error) {
          return {};
        } else return;
      }
    };
    if (courseId) fetchCourse();
  }, [courseId]);
  return <CourseForm courseData={course as CourseWithAuthor} />;
}

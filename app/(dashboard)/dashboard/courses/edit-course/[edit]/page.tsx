import { getCourseById } from "@/actions/courses.actions";
import CourseForm from "@/components/dashboard/courseForm/CourseForm";
import { courseSchema } from "@/types/courseForm.schema";
import { InferSelectModel } from "drizzle-orm";
import { courseTable } from "@/db/schema";
import { Squirrel } from "lucide-react";
import { z } from "zod";

export default async function EditCoursePage({ params }) {
  const parts = params.edit?.split("-");
  const courseId = Number(parts[parts.length - 1]);
  const { course } = await getCourseById(courseId);

  const formattedData: z.infer<typeof courseSchema> & { draftMode: boolean } = {
    ...course,
    dateRange: {
      from: new Date(course.dateRange.from),
      to: new Date(course.dateRange.to),
    },
    timeSlot: {
      from: new Date(course.timeSlot.from),
      to: new Date(course.timeSlot.to),
    },
    days: course.days === null ? undefined : course.days,
  };
  if (!courseId || !course)
    return (
      <div className="flex h-[calc(100vh-73px)] flex-col items-center justify-center space-y-10">
        <Squirrel size={200} strokeWidth={0.6} />
        <p className="text-2xl font-medium tracking-widest">No courses found</p>
      </div>
    );

  return (
    <CourseForm
      editMode={true}
      courseData={formattedData}
      courseId={courseId}
    />
  );
}

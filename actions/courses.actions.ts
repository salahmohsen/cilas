"use server";

import db from "@/db/drizzle";
import { courseTable } from "@/db/schema";
import { courseSchema } from "@/types/courseForm.schema";
import { eq, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadImage } from "@/lib/cloudinary.utils";
import {
  courseSchemaToDbSchema,
  formDataToCourseSchema,
} from "@/lib/actions.utils";
import { coursesFilter } from "@/lib/drizzle.utils";
import { CoursesFilter } from "@/types/drizzle.types";

export type CourseFormState = {
  success?: boolean;
  error?: boolean;
  courseId?: number;
  message: string;
};

export async function createEditCourse(
  prevState: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  let formObj = formDataToCourseSchema(formData);
  const draftMode: boolean = JSON.parse(formData.get("draftMode") as string);
  const editMode: boolean = JSON.parse(formData.get("editMode") as string);
  let courseId: string | number = formData.get("courseId") as string;
  if (courseId && typeof courseId === "string") {
    courseId = Number(courseId) as number;
  }

  // parse the data
  try {
    const parse = courseSchema.safeParse(formObj);
    if (!parse.success) {
      return {
        error: true,
        message: `An error occurred while processing the form values: ${parse.error.errors.map((e) => `${e.path[0]} `)}`,
      };
    }
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: `${error.message}`,
      };
  }

  // uploading the image if data parsing is succeed
  const imageUrl = await uploadImage(formObj.image);
  if (imageUrl instanceof Error)
    return {
      error: true,
      message: "Image Uploading Failed, please try again later!",
    };

  // Initialize the values for the database
  const dbObj = courseSchemaToDbSchema(formObj, draftMode, imageUrl as string);

  // Publish new course
  if (!editMode) {
    try {
      const result = await db
        .insert(courseTable)
        .values(dbObj)
        .returning({ Id: courseTable.id });

      revalidatePath("/", "layout");
      return {
        success: true,
        message: "Course published successfully",
        courseId: result[0].Id,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: true,
          message: `Oops! Course addition failed. Please try again. ${error.message}`,
        };
    }

    // Edit existing course
  } else if (editMode && typeof courseId === "number") {
    try {
      const result = await db
        .update(courseTable)
        .set(dbObj)
        .where(eq(courseTable.id, courseId))
        .returning({ Id: courseTable.id });

      revalidatePath("/", "layout");
      return {
        success: true,
        message: "Course edited successfully",
        courseId: result[0].Id,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: true,
          message: `Oops! Course edit failed. Please try again. ${error.message}`,
        };
    }
  }
  return {
    error: true,
    message: "Something went wrong, please try again later",
  };
}

export const getCourses = async (
  filter: CoursesFilter,
  page: number = 1,
  pageSize: number = 10,
) => {
  const courses = await db.query.courseTable.findMany({
    where: coursesFilter(filter),
    with: { author: true },
    limit: pageSize,
    offset: (page - 1) * pageSize,
    orderBy: [desc(courseTable.startDate), desc(courseTable.createdAt)],
  });

  return courses;
};

export const getCourseById = async (courseId: number) => {
  let course = await db.query.courseTable.findFirst({
    where: eq(courseTable.id, courseId),
    with: {
      author: true,
    },
  });
  if (course)
    return {
      ...course,
      timeSlot: {
        from: new Date(course.timeSlot.from),
        to: new Date(course.timeSlot.to),
      },
    };
};

type DeleteCourseState = {
  success?: boolean;
  error?: boolean;
  deletedId?: number;
  message?: string;
};
export const deleteCourse = async (
  prevState: DeleteCourseState,
  formData: FormData,
): Promise<DeleteCourseState> => {
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string")
    return { error: true, message: "invalid course id!" };

  try {
    const statement = await db
      .delete(courseTable)
      .where(eq(courseTable.id, Number(courseId)));

    revalidatePath("/", "layout");
    return {
      success: true,
      deletedId: Number(courseId),
      message: "Course deleted successfully!",
    };
  } catch (e) {
    console.error(e);
    return {
      error: false,
      message: "Oops! Course deletion failed. Please try again later.",
    };
  }
};

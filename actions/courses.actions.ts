"use server";

import db from "@/db/drizzle";
import { courseTable, userTable } from "@/db/schema";
import { courseSchema } from "@/types/courseForm.schema";
import { eq, desc, sql, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadImage } from "@/lib/cloudinary.utils";
import {
  courseSchemaToDbSchema,
  formDataToCourseSchema,
} from "@/lib/actions.utils";
import slug from "slug";
import { coursesFilter } from "@/lib/drizzle.utils";
import { CoursesFilter } from "@/types/drizzle.types";

export type CourseFormState = {
  success?: string;
  error?: string;
  isPending: boolean;
};

export async function createCourse(
  draftMode: boolean,
  editMode: boolean,
  courseId: number | undefined,
  prevState: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  let formObj = formDataToCourseSchema(formData);
  // parse the data
  try {
    const parse = courseSchema.safeParse(formObj);
    if (!parse.success) {
      return {
        error: `An error occurred while processing the form values: ${parse.error.errors.map((e) => `${e.path[0]} `)}`,
        isPending: false,
      };
    }
  } catch (error) {
    if (error instanceof Error)
      return {
        error: `${error.message}`,
        isPending: false,
      };
  }

  // uploading the image if data parsing is succeed
  const imageUrl = await uploadImage(formObj.image);
  if (imageUrl instanceof Error)
    return {
      error: "Image Uploading Failed, please try again later!",
      isPending: false,
    };

  // Initialize the values for the database
  const dbObj = courseSchemaToDbSchema(formObj, draftMode, imageUrl as string);

  // Publish new course
  if (!editMode) {
    try {
      const statement = db
        .insert(courseTable)
        .values(dbObj)
        .returning({ insertedId: courseTable.id });
      const result = await db.execute(statement);

      revalidatePath("/");
      return {
        success: "Course published successfully",
        isPending: false,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: `Oops! Course addition failed. Please try again. ${error.message}`,
          isPending: false,
        };
    }
    // Edit existing course
  } else if (editMode && courseId) {
    try {
      const statement = db
        .update(courseTable)
        .set(dbObj)
        .where(eq(courseTable.id, courseId));
      const result = await statement.execute();
      revalidatePath("/");
      return {
        success: "Course edited successfully",
        isPending: false,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: `Oops! Course edit failed. Please try again. ${error.message}`,
          isPending: false,
        };
    }
  }
  return {
    error: "Something went wrong, please try again later",
    isPending: false,
  };
}

export const getCourses = async (
  filter: CoursesFilter,
  page: number = 1,
  pageSize: number = 10,
) => {
  const data = await db
    .select()
    .from(courseTable)
    .innerJoin(userTable, eq(courseTable.authorId, userTable.id))
    .where(coursesFilter(filter))
    .orderBy(
      desc(sql`(${courseTable.dateRange}->>'to')::timestamp`),
      asc(courseTable.id),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return data;
};

export const getCourseById = async (courseId) => {
  const course = await db
    .select()
    .from(courseTable)
    .where(eq(courseTable.id, Number(courseId)))
    .innerJoin(userTable, eq(courseTable.authorId, userTable.id))
    .limit(0);

  return course[0];
};

type DeleteCourseState = { success?: "string"; error?: "string" };
export const deleteCourse = async (
  courseId: number,
  prevState: DeleteCourseState,
): Promise<DeleteCourseState> => {
  let state = {};
  try {
    const statement = db
      .delete(courseTable)
      .where(eq(courseTable.id, courseId));
    await db.execute(statement);

    state = { success: "Course deleted successfully!" };
  } catch (e) {
    console.error(e);
    state = { error: "Oops! Course deletion failed. Please try again later." };
  }
  revalidatePath("/");
  return state;
};

export type DuplicateCourseState =
  | {
      success?: string;
      error?: string;
      editLink?: string;
    }
  | undefined;
export const duplicateCourse = async (
  courseId: number,
  prevState: DuplicateCourseState,
): Promise<DuplicateCourseState> => {
  let selectedCourse;
  try {
    // get course values
    selectedCourse = await db
      .select()
      .from(courseTable)
      .where(eq(courseTable.id, courseId))
      .execute();

    // edit course values
    delete (selectedCourse[0] as any).id;
    selectedCourse[0].enTitle += " Duplicate";
    selectedCourse[0].arTitle += " نسخة";
    selectedCourse[0].draftMode = true;
  } catch (error) {
    if (error instanceof Error)
      return { error: `Oops! Course duplication failed: ${error.message}` };
  }
  try {
    // insert course values
    let duplicatedCourse = await db
      .insert(courseTable)
      .values(selectedCourse)
      .returning()
      .execute();

    // validate path
    revalidatePath("/dashboard");
    // create edit link
    const editLink = `/dashboard/courses/edit-course/${slug(duplicatedCourse[0].enTitle || duplicatedCourse[0].arTitle)}-${duplicatedCourse[0].id}`;
    return { success: "Course duplicated successfully!", editLink };
  } catch (error) {
    if (error instanceof Error)
      return { error: `Oops! Course duplication failed: ${error.message}` };
  }
};

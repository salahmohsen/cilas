"use server";

import db from "@/db/drizzle";
import { courseTable, userTable } from "@/db/schema";

import { z } from "zod";
import { courseSchema } from "@/types/courseForm.schema";
import { eq, desc, InferInsertModel, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cleanHtml } from "@/lib/sanitize-html.utils";
import { convertToDate, convertToJson } from "@/lib/zodValidation.utils";
import { uploadImage } from "@/lib/cloudinary.utils";
import slug from "slug";

export type CourseFormState = {
  success?: string;
  error?: string;
  isPending: boolean;
};

export const getPublishedCourses = async () => {
  const data = await db
    .select()
    .from(courseTable)
    .where(eq(courseTable.draftMode, false))
    .orderBy(desc(courseTable.createdAt));

  return data;
};

export async function createCourse(
  draftMode: boolean,
  editMode: boolean,
  courseId: number | undefined,
  prevState: CourseFormState,
  data: FormData,
): Promise<CourseFormState> {
  const formData = Object.fromEntries(data);
  let formObject: z.infer<typeof courseSchema> = {
    enTitle: formData["enTitle"] as string,
    arTitle: formData["arTitle"] as string,
    enContent: cleanHtml(formData["enContent"] as string),
    arContent: cleanHtml(formData["arContent"] as string),
    authorId: formData["authorId"] as string,
    category: formData["category"] as string,
    image: formData["image"] as File | string,
    attendance: formData["attendance"] as string,
    isRegistrationOpen: formData["isRegistrationOpen"] === "Open",
    price: formData["price"] as string,
    timeSlot: {
      from: convertToDate(formData["timeSlot"] as string, "from"),
      to: convertToDate(formData["timeSlot"] as string, "to"),
    },
    days: convertToJson(formData["days"] as string),
    courseFlowUrl: formData["courseFlowUrl"] as string,
    applyUrl: formData["applyUrl"] as string,
    dateRange: {
      from: convertToDate(formData["dateRange"] as string, "from"),
      to: convertToDate(formData["dateRange"] as string, "to"),
    },
  };

  try {
    const parse = courseSchema.safeParse(formObject);
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
  // uploading the image in case of data parsing is succeed
  const imageUrl = await uploadImage(formObject.image);
  if (imageUrl instanceof Error)
    return {
      error: "Image Uploading Failed, please try again later!",
      isPending: false,
    };

  // Initialize the values for the database
  const dbObject: InferInsertModel<typeof courseTable> = {
    ...formObject,
    draftMode,
    image: imageUrl,
  };
  // Create new course
  if (!editMode) {
    try {
      const statement = db
        .insert(courseTable)
        .values(dbObject)
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
        .set(dbObject)
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
    // Edit Course Mode & Save as a draft => new copy of the course as draft
  }
  return {
    error: "Something went wrong, please try again later",
    isPending: false,
  };
}

export const getArchivedCourses = async () => {
  const data = await db
    .select()
    .from(courseTable)
    .leftJoin(userTable, eq(courseTable.authorId, userTable.id))
    .where(
      lt(sql`${courseTable}.date_range->>'to'`, new Date().toISOString()) &&
        eq(courseTable.draftMode, false),
    )
    .orderBy(desc(courseTable.createdAt));

  return data;
};

export const getDraftCourses = async () => {
  const data = await db
    .select()
    .from(courseTable)
    .leftJoin(userTable, eq(courseTable.authorId, userTable.id))
    .where(eq(courseTable.draftMode, true))
    .orderBy(desc(courseTable.createdAt));

  return data;
};

export const getCourseById = async (courseId) => {
  const course = await db
    .select()
    .from(courseTable)
    .where(eq(courseTable.id, Number(courseId)));
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

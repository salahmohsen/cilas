"use server";

import db from "@/db/drizzle";
import { courseTable, userTable } from "@/db/schema";

import { z } from "zod";
import { courseSchema } from "@/types/courseForm.schema";

import { eq, desc, InferInsertModel, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cleanHtml } from "@/lib/sanitize-html";
import { convertToDate, convertToJson, uploadImage } from "@/lib/form.utils";

export type CourseFormState = {
  success?: string;
  error?: string;
  isPending: boolean;
};

export async function createCourse(
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
    image: imageUrl,
  };

  if (!editMode) {
    try {
      const statement = db
        .insert(courseTable)
        .values(dbObject)
        .returning({ insertedId: courseTable.id });
      const result = await db.execute(statement);
      console.log("DB Result", result);
      revalidatePath("/");
      return {
        success: "Course created successfully",
        isPending: false,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: `Oops! Course addition failed. Please try again. ${error.message}`,
          isPending: false,
        };
    }
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
    .where(lt(sql`${courseTable}.date_range->>'to'`, new Date().toISOString()))
    .orderBy(desc(courseTable.createdAt));

  return data;
};

export const getCourses = async () => {
  const data = await db
    .select()
    .from(courseTable)
    .orderBy(desc(courseTable.createdAt));
  revalidatePath("/courses");
  return data;
};

export const getCourseById = async (courseId) => {
  const course = await db
    .select()
    .from(courseTable)
    .where(eq(courseTable.id, Number(courseId)));
  return course[0];
};

type DeleteFormState = { success?: "string"; error?: "string" };
export const deleteCourse = async (
  courseId: number,
  prevState: DeleteFormState,
): Promise<DeleteFormState> => {
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

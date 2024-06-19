"use server";

import db from "@/db/drizzle";
import { courseTable, userTable } from "@/db/schema";

import { z } from "zod";
import { courseSchema } from "@/types/courseForm.schema";

import { format } from "date-fns";
import { eq, desc, InferInsertModel, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cloudinaryUploader } from "@/lib/cloudinary";
import { cleanHtml } from "@/lib/sanitize-html";
import { redirect } from "next/navigation";

type CourseFormState = {
  success?: string;
  error?: string;
  isPending: boolean;
};

export async function courseAction(
  prevState: CourseFormState,
  data: FormData,
): Promise<CourseFormState> {
  console.log("authorId", data.get("authorId"));
  // Helper conversion function
  const convert = (
    value: string,
    state?: "from" | "to",
    type?: "date" | "time",
  ): unknown => {
    if (value && !state && !type) return JSON.parse(value);
    if (value && state) {
      if (!type) return JSON.parse(value)[state];
      if (type === "date") return new Date(JSON.parse(value)[state]);
      if (type === "time") return format(JSON.parse(value)[state], "HH:mm");
    }
  };

  // The object that we will send it back to user in case of errors
  let formObject: z.infer<typeof courseSchema> = {
    enTitle: data.get("enTitle"),
    arTitle: data.get("arTitle"),
    enContent: cleanHtml(data.get("enContent") as string),
    arContent: cleanHtml(data.get("arContent") as string),
    authorId: data.get("authorId") as string,
    category: data.get("category") as string,
    image: data.get("image") as File,
    attendance: data.get("attendance") as string,
    isRegistrationOpen: data.get("isRegistrationOpen") === "Open",
    price: data.get("price") ? Number(data.get("price")) : undefined,
    timeSlot: {
      from: convert(data.get("timeSlot") as string, "from", "date") as Date,
      to: convert(data.get("timeSlot") as string, "to", "date") as Date,
    },
    days: convert(data.get("days") as string) as {
      value: string;
      label: string;
    }[],
    courseFlowUrl: data.get("courseFlowUrl"),
    applyUrl: data.get("applyUrl"),
    dateRange: {
      from: convert(data.get("dateRange") as string, "from", "date") as Date,
      to: convert(data.get("dateRange") as string, "to", "date") as Date,
    },
  };

  // validating the data
  let formState: {
    error?: string;
    success?: string;
    fields?: z.infer<typeof courseSchema>;
    isPending: boolean;
  };
  try {
    const parse = courseSchema.safeParse(formObject);
    if (!parse.success) {
      return {
        error: `An error occurred while processing the form values: ${parse.error.errors[0].message}`,
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
  // uploading the image in case of data is succeed
  const uploadImage = async (): Promise<string> => {
    const image = formObject.image as File;
    if (image.size === 0) return "";

    const imageData = new FormData();
    imageData.append("image", image as Blob);
    imageData.append("folder", "courses");

    try {
      const imageUrl = await cloudinaryUploader(imageData);
      return imageUrl;
    } catch (e) {
      return {
        error: "Image Uploading Failed, please try again later!",
        isPending: false,
      };
    }
  };
  // Initialize the values for the database
  const dbObject: InferInsertModel<typeof courseTable> = {
    ...formObject,
    image: await uploadImage(),
  };
  console.log("dbObject", dbObject);

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
        // fields: formObject,
        isPending: false,
      };
  }
}

export const getArchived = async () => {
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
    .where(eq(courseTable.id, Number(courseId)))
    .orderBy(desc(courseTable.createdAt));
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

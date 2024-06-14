"use server";

import db from "@/db/drizzle";
import { courseTable, userTable } from "@/db/schema";

import { z } from "zod";
import { courseFormSchema } from "@/types/courseForm.schema";

import { format } from "date-fns";
import { eq, desc, InferInsertModel, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cloudinaryUploader } from "@/lib/cloudinary";
import { cleanHtml } from "@/lib/sanitize-html";
import { redirect } from "next/navigation";

export type FormState = {
  success?: string;
  error?: string;
  fields?: z.infer<typeof courseFormSchema>;
  isPending: boolean;
};

export async function courseAction(
  prevState: FormState,
  data: FormData,
): Promise<FormState> {
  let formState: FormState;
  const formData: {} = Object.fromEntries(data);

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
  const formObject: z.infer<typeof courseFormSchema> = {
    enTitle: formData["enTitle"],
    arTitle: formData["arTitle"],
    enContent: formData["enContent"],
    arContent: formData["arContent"],
    authorId: +formData["authorId"],
    category: formData["category"],
    image: formData["image"] as File,
    attendance: formData["attendance"],
    isRegistrationOpen: formData["isRegistrationOpen"] === "Open",
    price: +formData["price"],
    timeSlot: {
      from: convert(formData["timeSlot"], "from", "date") as Date,
      to: convert(formData["timeSlot"], "to", "date") as Date,
    },
    days: convert(formData["days"]) as { value: string; label: string }[],
    courseFlowUrl: formData["courseFlowUrl"],
    applyUrl: formData["applyUrl"],
    dateRange: {
      from: convert(formData["dateRange"], "from", "date") as Date,
      to: convert(formData["dateRange"], "to", "date") as Date,
    },
  };

  // validating the data
  try {
    const parse = courseFormSchema.safeParse(formObject);
    if (!parse.success) {
      throw new TypeError(
        `An error occurred while processing the form values: ${parse.error.errors[0].message}`,
      );
    }
  } catch (error) {
    if (error instanceof Error)
      formState = {
        error: error.message,
        isPending: false,
      };
  }
  // uploading the image in case of data is succeed
  const uploadImage = async (): Promise<string> => {
    const image = formData["image"] as File;
    if (image.size === 0) return "";

    const imageData = new FormData();
    imageData.append("image", image as Blob);
    imageData.append("folder", "courses");

    try {
      return await cloudinaryUploader(imageData);
    } catch (e) {
      formState = {
        error: "Image Uploading Failed, please try again later!",
        isPending: false,
        fields: formObject,
      };
      return "";
    }
  };
  // Initialize the values for the database
  const dbObject: InferInsertModel<typeof courseTable> = {
    enTitle: formData["enTitle"],
    enContent: cleanHtml(formData["enContent"]),
    arTitle: formData["arTitle"],
    arContent: cleanHtml(formData["arContent"]),
    image: await uploadImage(),
    authorId: +formData["authorId"],
    category: formData["category"],
    registrationStatus: formData["isRegistrationOpen"] === "Open",
    attendance: formData["attendance"],
    price: +formData["price"],
    days: convert(formData["days"]),
    startDate: convert(formData["dateRange"], "from") as string,
    endDate: convert(formData["dateRange"], "from") as string,
    sessionStartTime: convert(formData["timeSlot"], "from", "time") as string,
    sessionEndTime: convert(formData["timeSlot"], "to", "time") as string,
    courseFlowUrl: formData["courseFlowUrl"],
    applyUrl: formData["applyUrl"],
  };

  try {
    const statement = db
      .insert(courseTable)
      .values(dbObject)
      .returning({ insertedId: courseTable.id });
    await db.execute(statement);
  } catch (error) {
    formState = {
      error: "Oops! Course addition failed. Please try again.",
      fields: formObject,
      isPending: false,
    };
  }

  formState = { success: "Course created successfully", isPending: false };

  revalidatePath("/");

  return formState;
}

export const getArchived = async () => {
  const data = await db
    .select()
    .from(courseTable)
    .leftJoin(userTable, eq(courseTable.authorId, userTable.id))
    .where(lt(courseTable.endDate, new Date().toISOString()))
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

export const deleteCourse = async (courseId: number, prevState) => {
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

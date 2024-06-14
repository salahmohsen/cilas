"use server";

import db from "@/db/drizzle";
import { CourseType, courses, users } from "@/db/schema";
import {
  CourseFormSchema,
  courseFormSchema,
} from "@/components/dashboard/courseForm/courseFormSchema";

import { format } from "date-fns";
import { gte, lte, eq, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cloudinaryUploader } from "@/lib/cloudinary";

export type FormState = {
  success?: string;
  error?: string;
  fields?: unknown;
};

export async function courseAction(
  prevState: FormState,
  data: CourseFormSchema,
): Promise<FormState> {
  const formData = Object.fromEntries(data);

  // Helper conversion function
  const convert = (
    value: string,
    state?: "from" | "to",
    type?: "date" | "time",
  ) => {
    if (value && !state && !type) return JSON.parse(value);
    if (value && state) {
      if (!type) return JSON.parse(value)[state];
      if (type === "date") return new Date(JSON.parse(value)[state]);
      if (type === "time") return format(JSON.parse(value)[state], "HH:mm");
    }
  };
  // The object that we will send it back to user in case of errors
  const formObject = {
    enTitle: formData["enTitle"],
    arTitle: formData["arTitle"],
    enContent: formData["enContent"],
    arContent: formData["arContent"],
    authorId: +formData["authorId"],
    category: formData["category"],
    image: formData["image"],
    attendance: formData["attendance"],
    isRegistrationOpen: formData["isRegistrationOpen"] === "Open",
    price: +formData["price"],
    timeSlot: {
      from: convert(formData["timeSlot"], "from", "date"),
      to: convert(formData["timeSlot"], "to", "date"),
    },
    days: convert(formData["days"]),
    courseFlowUrl: formData["courseFlowUrl"],
    applyUrl: formData["applyUrl"],
    dateRange: {
      from: convert(formData["dateRange"], "from", "date"),
      to: convert(formData["dateRange"], "to", "date"),
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
      return {
        error: error.message,
      };
  }
  // uploading the image in case of data is succeed
  const uploadImage = async () => {
    const image = formData["image"];

    const imageData = new FormData();
    imageData.append("image", image as Blob);
    imageData.append("folder", "courses");
    let imageUrl;

    try {
      imageUrl = await cloudinaryUploader(imageData);
    } catch (e) {
      return {
        error: "Image Uploading Failed, please try again later!",
        fields: formObject,
      };
    }
    return imageUrl;
  };

  // Initialize the values for the database
  const dbObject = {
    enTitle: formData["enTitle"],
    enContent: formData["enContent"],
    arTitle: formData["arTitle"],
    arContent: formData["arContent"],
    image: await uploadImage(),
    authorId: Number(formData["authorId"]),
    category: formData["category"],
    registrationStatus: formData["isRegistrationOpen"] === "Open",
    attendance: formData["attendance"],
    price: +formData["price"],
    days: convert(formData["days"]),
    startDate: convert(formData["dateRange"]).from,
    endDate: convert(formData["dateRange"]).to,
    sessionStartTime: convert(formData["timeSlot"], "from", "time"),
    sessionEndTime: convert(formData["timeSlot"], "to", "time"),
    courseFlowUrl: formData["courseFlowUrl"],
    applyUrl: formData["applyUrl"],
  };

  try {
    const statement = db
      .insert(courses)
      .values(dbObject)
      .returning({ insertedId: courses.id });
    await db.execute(statement);
    revalidatePath("/");
    return { success: "Course created successfully" };
  } catch (error) {
    return {
      error: "Oops! Course addition failed. Please try again.",
      fields: formObject,
    };
  }
}

export const getArchived = async () => {
  const data = await db
    .select()
    .from(courses)
    .leftJoin(users, eq(courses.authorId, users.id))
    .where(lte(courses.endDate, new Date()))
    .orderBy(desc(courses.createdAt));

  console.log("Archived Posts", data);

  return data;
};

export const getCourses = async () => {
  const data = await db.select().from(courses).orderBy(desc(courses.createdAt));
  revalidatePath("/courses");
  return data;
};

export const getCourseById = async (courseId) => {
  const course = await db
    .select()
    .from(courses)
    .where(eq(courses.id, Number(courseId)))
    .orderBy(desc(courses.createdAt));
  return course[0];
};

export const deleteCourse = async (courseId: number, prevState) => {
  console.log("prevState", prevState);
  try {
    const statement = db.delete(courses).where(eq(courses.id, courseId));
    await db.execute(statement);

    // For an unknown reason, revalidating the path does not result in a successful return.
    // revalidatePath("/dashboard");

    return {
      success: "Course deleted successfully!",
    };
  } catch (e) {
    console.error(e);
    // console.log("Oops! Course deletion failed. Please try again later");
    return { error: "Oops! Course deletion failed. Please try again later." };
  }
};

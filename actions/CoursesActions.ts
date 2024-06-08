"use server";

import db from "@/db/drizzle";
import { courses, users } from "@/db/schema";
import { FormInputs, createCourseSchema } from "@/schemas/newCourseSchema";
import { format } from "date-fns";
import { gte, lte, eq, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const createCourseAction = async (data: FormInputs, prevState) => {
  const parsed = createCourseSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  } else {
  }
  const formatedData = {
    enTitle: data.enTitle,
    arTitle: data.arTitle,
    image: data.imageUrl,
    authorId: Number(data.authorId),
    enContent: data.enContent,
    arContent: data.arContent,
    category: data.category,
    attendance: data.attendance,
    registrationStatus: data.registrationStatus === "open" ? true : false,
    price: data.price,
    startDate: format(data.dateRange.from, "yyyy-MM-dd"),
    endDate: format(data.dateRange.to, "yyyy-MM-dd"),
    days: data.days,
    sessionStartTime: format(data.sessionStartTime, "HH:mm"),
    sessionEndTime: format(data.sessionEndTime, "HH:mm"),
    courseFlowUrl: data.courseFlowUrl,
    applyUrl: data.applyUrl,
  };

  try {
    const statement = db
      .insert(courses)
      .values(formatedData)
      .returning({ insertedId: courses.id });

    await db.execute(statement);
    revalidatePath("/courses");

    return { success: "Course created successfully!" };
  } catch (error) {
    console.log(error);
    return { error: "Oops! Course addition failed. Please try again later." };
  }
};

export const getArchived = async () => {
  // const data = await db
  //   .select()
  //   .from(courses)
  //   .where(lte(courses.endDate, new Date().toDateString()));

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

"use server";

import db from "@/db/drizzle";
import { courses, users } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const getCourses = async () => {
  const data = await db.select().from(courses).orderBy(desc(courses.createdAt));
  revalidatePath("/courses");
  return data;
};

export const getCourse = async (courseId: number) => {
  const course = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId))
    .orderBy(desc(courses.createdAt));

  revalidatePath("/courses");
  return course;
};

export const getAuthor = async (authorId: number) => {
  const data = await db.select().from(users).where(eq(users.id, authorId));
  revalidatePath("/courses");
  return data;
};

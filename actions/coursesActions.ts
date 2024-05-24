"use server";

import db from "@/db/drizzle";
import { courses, users } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const getCourses = async () => {
  const data = await db.select().from(courses);
  revalidatePath("/courses");
  return data;
};

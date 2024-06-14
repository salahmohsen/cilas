"use server";

import db from "@/db/drizzle";
import { courses, users } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { number } from "zod";

export const getUsersNames = async () => {
  const result = await db
    .select({
      id: users.id,
      name: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
    })
    .from(users);

  return result;
};

export const getUserById = async (authorId: number) => {
  const data = await db.select().from(users).where(eq(users.id, authorId));
  revalidatePath("/courses");
  return data[0];
};

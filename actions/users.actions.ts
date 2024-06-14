"use server";

import db from "@/db/drizzle";
import { courses, userTable } from "@/db/schema";
import { asc, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { number } from "zod";

export const getUsersNames = async () => {
  const result = await db
    .select({
      id: userTable.id,
      name: sql<string>`${userTable.firstName} || ' ' || ${userTable.lastName}`,
    })
    .from(userTable);

  return result;
};

export const getUserById = async (authorId: number) => {
  const data = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, authorId));
  revalidatePath("/courses");
  return data[0];
};

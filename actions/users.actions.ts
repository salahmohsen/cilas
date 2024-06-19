"use server";

import db from "@/db/drizzle";
import { userTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const createUser = async (
  id: string,
  email: string,
  password_hash: string,
) => {
  try {
    const stmt = db
      .insert(userTable)
      .values({ id, email, password_hash, role: "user" });
    await db.execute(stmt);
    return { success: "user made!" };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
  }
};

export const getUsersNamesByRole = async (
  role: "user" | "author" | "admin",
) => {
  const result = await db
    .select({
      id: userTable.id,
      name: sql<string>`${userTable.firstName} || ' ' || ${userTable.lastName}`,
    })
    .from(userTable)
    .where(eq(userTable.role, role));

  return result;
};

export const getUserById = async (authorId: string) => {
  const data = await db
    .select()
    .from(userTable)
    .where(eq(userTable.id, authorId));
  revalidatePath("/courses");
  return data[0];
};

export const getUserByEmail = async (email: string) => {
  const data = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, email));

  return data[0];
};

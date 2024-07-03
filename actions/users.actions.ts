"use server";

import { revalidatePath } from "next/cache";
import db from "@/db/drizzle";
import { userTable } from "@/db/schema";
import { FellowSchema } from "@/types/fellow.schema";
import { eq } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import { z } from "zod";
import { SafeUser } from "@/types/drizzle.types";

export const addUser = async (
  id: string,
  email: string,
  passwordHash: string,
) => {
  try {
    const stmt = db
      .insert(userTable)
      .values({ id, email, passwordHash, role: "user" });
    await db.execute(stmt);
    return { success: "user made!" };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
  }
};

export const getUsersByRole = async (role: "user" | "fellow" | "admin") => {
  const users = await db.query.userTable.findMany({
    where: eq(userTable.role, role),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  return users;
};

export const getUserById = async (userId: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  revalidatePath("/courses");
  return user;
};

export const getUserByEmail = async (email: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.email, email),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  return user;
};

// @important This will return password included
export const _getUserByEmail = async (email: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.email, email),
  });

  return user;
};

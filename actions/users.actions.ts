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

export type FellowState = {
  success?: boolean;
  error?: boolean;
  message: string;
  fellow?: SafeUser;
};

export const addFellow = async (
  prevState: FellowState,
  formData: FormData,
): Promise<FellowState> => {
  const formEntries: z.infer<typeof FellowSchema> = Object.fromEntries(
    formData,
  ) as z.infer<typeof FellowSchema>;

  try {
    const parse = FellowSchema.safeParse(formEntries);
    if (!parse.success)
      throw new Error(
        `An error occurred while processing the form values: ${parse.error.errors.map((e) => e.path[0])}`,
      );
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: error.message,
      };
  }

  try {
    const id = generateIdFromEntropySize(10); // 16 characters long
    const fellow = await db
      .insert(userTable)
      .values({ id, ...formEntries, role: "fellow" })
      .returning();

    const { passwordHash, googleId, ...safeFellow } = fellow[0];

    return {
      success: true,
      message: "Fellow added successfully",
      fellow: safeFellow,
    };
  } catch (error) {
    if (error instanceof Error)
      if (
        error.message ===
        'duplicate key value violates unique constraint "user_email_unique"'
      ) {
        try {
          const fellow = await db
            .update(userTable)
            .set({ role: "fellow" })
            .where(eq(userTable.email, formEntries.email))
            .returning();

          const { googleId, passwordHash, ...safeFellow } = fellow[0];

          return {
            success: true,
            message:
              "This user was already in the database and converted to fellow successfully",
            fellow: safeFellow,
          };
        } catch (error) {
          if (error instanceof Error)
            return { error: true, message: error.message };
        }
      } else {
        return { error: true, message: error.message };
      }
  }

  return { error: true, message: "An unexpected error occurred" };
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

export const getUsersNamesByRole = async (
  role: "user" | "fellow" | "admin",
) => {
  const users = await db.query.userTable.findMany({
    where: eq(userTable.role, role),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
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

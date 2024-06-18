"use server";

import db from "@/db/drizzle";
import { userTable } from "@/db/schema";
import { signInSchema } from "@/types/auth.schema";
import { generateIdFromEntropySize } from "lucia";
import * as argon2 from "argon2";

export async function signInAction(prevState, formData: FormData) {
  const email = formData.get("email");
  const password = formData.get("password");
  return {};
}

export async function signUpAction(prevState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const parse = signInSchema.safeParse({ email, password });
    if (!parse.success) {
      throw new Error(`Email or password is not valid!`);
    }
  } catch (error) {
    if (error instanceof Error)
      return {
        error: error.message,
      };
  }

  const password_hash = await argon2.hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const userId = generateIdFromEntropySize(10); // 16 characters long

  try {
    const stmt = db
      .insert(userTable)
      .values({ id: userId, email, password_hash, role: "user" });
    await db.execute(stmt);
    return { success: "user made!" };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
  }
}

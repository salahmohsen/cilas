"use server";

import db from "@/db/drizzle";
import { userTable } from "@/db/schema";
import { signupSchema } from "@/types/auth.schema";
import { generateIdFromEntropySize } from "lucia";
import { hash, verify } from "@node-rs/argon2";
import {
  createAuthSession,
  lucia,
  validateRequest,
} from "@/lib/auth";
import { createUser, getUserByEmail } from "./users.actions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export async function signupAction(prevState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const passwordConfirmation = formData.get("passwordConfirmation") as string;
  try {
    const parse = signupSchema.safeParse({
      email,
      password,
      passwordConfirmation,
    });
    if (!parse.success) {
      throw new Error(`Email or password is not valid!`);
    }
  } catch (error) {
    if (error instanceof Error)
      return {
        error: error.message,
      };
  }

  const password_hash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const userId = generateIdFromEntropySize(10); // 16 characters long
  const existingUser = await getUserByEmail(email);
  try {
    if (existingUser) return { error: "This Email is already signed up" };
    createUser(userId, email, password_hash);
  } catch (error) {
    if (error instanceof Error)
      console.log(`creating user error: ${error.message}`);
  }
  try {
    await createAuthSession(userId);
  } catch (error) {
    if (error instanceof Error)
      console.log(`creating session error ${error.message}`);
  }
  return { success: "Account created successfully!" };
}

export async function signinAction(prevState, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const existingUser = await getUserByEmail(email);
  if (!existingUser || !existingUser.password_hash) {
    return {
      error: "You have entered an invalid username or password",
    };
  }

  const isValidPassword = await verify(existingUser.password_hash, password);
  if (!isValidPassword)
    return {
      error: "You have entered an invalid username or password",
    };
  await createAuthSession(existingUser.id);
  return { success: true };
}

export const logout = async () => {
  const { session } = await validateRequest();
  if (!session) {
    return {
      error: "Unauthorized",
    };
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
  );
  return redirect("/login");
};
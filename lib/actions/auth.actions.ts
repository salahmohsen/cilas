"use server";

import { createAuthSession, lucia, validateRequest } from "@/lib/apis/auth.api";
import { signinSchema, signupSchema } from "@/lib/types/auth.schema";
import { hash, verify } from "@node-rs/argon2";
import { generateIdFromEntropySize } from "lucia";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthState } from "../types/users.actions.types";
import { _getUserByEmail, addUser } from "./users.actions";

// signin action --------------------------------------------------------------------

export async function signin(
  prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const parse = signinSchema.safeParse({ email, password });
    if (!parse.success)
      throw new Error(
        `creating user error: ${parse.error.errors.map((error, index) => `${error.path[index]} ${error.message[index]}}`)}`,
      );
  } catch (error) {
    if (error instanceof Error) return { error: true, message: `${error.message}` };
  }

  const existingUser = await _getUserByEmail(email);

  if (existingUser && !existingUser.passwordHash)
    return {
      error: true,
      message:
        "It looks like you're already signed up with your Google account. Please continue by logging in with your Google account to access your profile",
    };

  if (!existingUser || !existingUser.passwordHash) {
    return {
      error: true,
      message: "You have entered an invalid username or password",
    };
  }
  const isValidPassword = await verify(existingUser.passwordHash, password);
  if (!isValidPassword)
    return { error: true, message: "You have entered an invalid username or password" };

  try {
    await createAuthSession(existingUser.id);
  } catch (error) {
    console.error(error);
    if (error instanceof Error) return { error: true, message: `${error.message}` };
  }

  const role = existingUser.role;

  // Note: This return is unreachable due to redirect, but added for type safety
  return {
    success: true,
    message: "Welcome! You have successfully logged in",
    redirectPath: `/${role}`,
  };
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
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
  return redirect("/signin");
};

/* signup action */

export async function signup(
  prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
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
        error: true,
        message: error.message,
      };
  }

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const userId = generateIdFromEntropySize(10); // 16 characters long
  const existingUser = await _getUserByEmail(email);
  try {
    if (existingUser && !existingUser.passwordHash)
      return {
        error: true,
        message:
          "It looks like you're already signed up with your Google account. Please continue by logging in with your Google account to access your profile",
      };
    if (existingUser) return { error: true, message: "This Email is already signed up." };
    await addUser(userId, email, passwordHash);
  } catch (error) {
    if (error instanceof Error) console.error(`creating user error: ${error.message}`);
  }
  try {
    await createAuthSession(userId);
    const { user } = await validateRequest();
    return {
      success: true,
      message: "Account created successfully!",
      redirectPath: `/${user?.role}`,
    };
  } catch (error) {
    if (error instanceof Error) console.log(`creating session error ${error.message}`);
  }
  return { success: true, message: "Account created successfully!" };
}

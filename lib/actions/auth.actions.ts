"use server";

import { signinSchema, signupSchema } from "@/lib/types/auth.schema";
import { generateIdFromEntropySize } from "lucia";
import { hash, verify } from "@node-rs/argon2";
import { createAuthSession, lucia, validateRequest } from "@/lib/apis/auth.api";
import { _getUserByEmail, addUser } from "./users.actions";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

// signin action --------------------------------------------------------------------

export type SigninState =
  | {
      error: string;
      success?: undefined;
    }
  | {
      success: string;
      error?: undefined;
    };

export async function signin(prevState, formData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const parse = signinSchema.safeParse({ email, password });
    if (!parse.success)
      throw new Error(
        `creating user error: ${parse.error.errors.map((error, index) => `${error.path[index]} ${error.message[index]}}`)}`,
      );
  } catch (error) {
    if (error instanceof Error) return { error: `${error.message}` };
  }

  const existingUser = await _getUserByEmail(email);

  if (existingUser && !existingUser.passwordHash)
    return {
      error:
        "It looks like you're already signed up with your Google account. Please continue by logging in with your Google account to access your profile",
    };

  if (!existingUser || !existingUser.passwordHash) {
    return {
      error: "You have entered an invalid username or password",
    };
  }
  const isValidPassword = await verify(existingUser.passwordHash, password);
  if (!isValidPassword)
    return { error: "You have entered an invalid username or password" };

  try {
    await createAuthSession(existingUser.id);
    redirect("/dashboard");
  } catch (error) {
    if (error instanceof Error) return { error: `${error.message}` };
  }
  return { success: "Welcome! You have successfully logged in" };
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
  return redirect("/signin");
};

///////// signup action /////////

export type SignupState =
  | {
      error: string;
      success?: undefined;
    }
  | {
      success: string;
      error?: undefined;
    };

export async function signup(prevState, formData: FormData) {
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
        error:
          "It looks like you're already signed up with your Google account. Please continue by logging in with your Google account to access your profile",
      };
    if (existingUser) return { error: "This Email is already signed up." };
    await addUser(userId, email, passwordHash);
  } catch (error) {
    if (error instanceof Error)
      console.log(`creating user error: ${error.message}`);
  }
  try {
    await createAuthSession(userId);
    redirect("/dashboard");
  } catch (error) {
    if (error instanceof Error)
      console.log(`creating session error ${error.message}`);
  }
  return { success: "Account created successfully!" };
}

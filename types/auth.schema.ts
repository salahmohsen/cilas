import { string } from "@/lib/form.utils";
import { z } from "zod";

export const signupSchema = z
  .object({
    email: string("required", "email"),
    password: string("required", "password"),
    passwordConfirmation: string("required", "password"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match!",
    path: ["passwordConfirmation"],
  });

export const signinSchema = z.object({
  email: string("required", "email"),
  password: string("required", "text"),
});

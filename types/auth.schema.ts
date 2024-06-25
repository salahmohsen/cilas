import { z } from "zod";
import { required_email, required_password } from "@/lib/zodValidation.utils";

export const signupSchema = z
  .object({
    email: required_email,
    password: required_password,
    passwordConfirmation: required_password,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match!",
    path: ["passwordConfirmation"],
  });

export const signinSchema = z.object({
  email: required_email,
  password: required_password,
});

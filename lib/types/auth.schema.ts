import { z } from "zod";
import {
  optional_string,
  required_email,
  required_password,
} from "@/lib/utils/zodValidation.utils";

export const signupSchema = z
  .object({
    email: required_email,
    password: required_password,
    passwordConfirmation: optional_string,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match!",
    path: ["passwordConfirmation"],
  });

export const signinSchema = z.object({
  email: required_email,
  password: required_password,
});

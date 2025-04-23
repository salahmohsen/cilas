import {
  optional_string,
  required_email,
  required_password,
} from "@/lib/utils/zod.utils";
import { z } from "zod";

const signupSchema = z
  .object({
    email: required_email,
    password: required_password,
    passwordConfirmation: optional_string,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match!",
    path: ["passwordConfirmation"],
  });

export type SignupSchema = z.infer<typeof signupSchema>;
export default signupSchema;

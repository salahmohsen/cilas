import { email, password, string } from "@/lib/utils/zod.utils";
import { z } from "zod";

const signupSchema = z
  .object({
    email: email().required,
    password: password(),
    passwordConfirmation: string().required,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Passwords do not match!",
    path: ["passwordConfirmation"],
  });

export type SignupSchema = z.infer<typeof signupSchema>;
export default signupSchema;

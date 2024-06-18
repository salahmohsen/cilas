import { string } from "@/lib/form.utils";
import { z } from "zod";

export const signInSchema = z.object({
  email: string("required", "email"),
  password: string("required", "password"),
});

export const signUpSchema = z.object({});

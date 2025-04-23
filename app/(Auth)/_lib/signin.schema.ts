import { required_email, required_password } from "@/lib/utils/zod.utils";
import { z } from "zod";

const signinSchema = z.object({
  email: required_email,
  password: required_password,
});

export type SigninSchema = z.infer<typeof signinSchema>;
export default signinSchema;

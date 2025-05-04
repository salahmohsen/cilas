import { email, password } from "@/lib/utils/zod.utils";
import { z } from "zod";

const signinSchema = z.object({
  email: email().required,
  password: password(),
});

export type SigninSchema = z.infer<typeof signinSchema>;
export default signinSchema;

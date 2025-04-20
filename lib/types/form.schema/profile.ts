import { z } from "zod";

import {
  optional_string,
  optional_tel,
  required_email,
  required_name,
  required_string,
} from "@/lib/utils/zodValidation.utils";
import { SafeUser } from "../drizzle.types";

const profileSchema = {
  schema: z.object({
    id: required_string,
    firstName: required_name("First name"),
    lastName: required_name("Last name"),
    userName: required_name("User name", 2, 15),
    avatar: optional_string,
    bio: optional_string,
    email: required_email,
    tel: optional_tel,
  }),
  defaults: (user: SafeUser) => ({
    id: user.id || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    userName: user.userName || "",
    avatar: user.avatar || "",
    bio: user.bio || "",
    email: user.email || "",
    tel: user.tel || "",
  }),
};

export type ProfileSchema = z.infer<typeof profileSchema.schema>;
export default profileSchema;

import { z } from "zod";

import { email, name, phone, string } from "@/lib/utils/zod.utils";
import { SafeUser } from "../../../../../lib/drizzle/drizzle.types";

const profileSchema = {
  schema: z.object({
    id: string().required,
    firstName: string().required,
    lastName: name(),
    userName: name(),
    avatar: string().optional,
    bio: string().optional,
    email: email().required,
    tel: phone().optional,
  }),
  defaults: (user: SafeUser | undefined) => ({
    id: user?.id ?? "",
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    userName: user?.userName ?? "",
    avatar: user?.avatar ?? "",
    bio: user?.bio ?? "",
    email: user?.email ?? "",
    tel: user?.tel ?? "",
  }),
};

export type ProfileSchema = z.infer<typeof profileSchema.schema>;
export default profileSchema;

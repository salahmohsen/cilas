import { z } from "zod";

import { email, name, phone, string } from "@/lib/utils/zod.utils";

const fellowSchema = {
  schema: z.object({
    firstName: name(),
    lastName: name(),
    bio: string().required,
    email: email().required,
    tel: phone().optional,
  }),
  defaults: {
    firstName: "",
    lastName: "",
    bio: "",
    email: "",
    tel: "",
  },
};

export type FellowSchema = z.infer<typeof fellowSchema.schema>;
export default fellowSchema;

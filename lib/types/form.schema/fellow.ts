import { z } from "zod";

import {
  optional_tel,
  required_email,
  required_name,
  required_string,
} from "@/lib/utils/zodValidation.utils";

const fellowSchema = {
  schema: z.object({
    firstName: required_name("First name"),
    lastName: required_name("Last name"),
    bio: required_string,
    email: required_email,
    tel: optional_tel,
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

import {
  required_string,
  required_email,
  optional_tel,
} from "@/lib/zodValidation.utils";

import { z } from "zod";

export const FellowSchema = z.object({
  firstName: required_string,
  lastName: required_string,
  bio: required_string,
  email: required_email,
  tel: optional_tel,
});

// Default Values for Course Form
export const fellowDefaultValues: z.infer<typeof FellowSchema> = {
  firstName: "",
  lastName: "",
  bio: "",
  email: "",
  tel: "",
};

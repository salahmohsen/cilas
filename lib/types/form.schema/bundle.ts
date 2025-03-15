import { z } from "zod";

import {
  optional_selectOptions,
  required_date,
  required_number,
  required_string,
} from "@/lib/utils/zodValidation.utils";

const bundleSchema = {
  schema: z.object({
    year: required_number,
    cycle: required_string,
    category: required_string,
    attendance: required_string,
    deadline: required_date,
    courses: optional_selectOptions,
  }),
  defaults: {
    year: "",
    cycle: "",
    category: "",
    attendance: "",
    deadline: new Date(),
    courses: [],
  },
};

export type BundleSchema = z.infer<typeof bundleSchema.schema>;
export default bundleSchema;

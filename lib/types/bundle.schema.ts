import {
  optional_selectOptions,
  required_date,
  required_number,
  required_string,
} from "@/lib/utils/zodValidation.utils";
import { z } from "zod";

export const bundleSchema = z.object({
  year: required_number,
  cycle: required_string,
  category: required_string,
  attendance: required_string,
  deadline: required_date,
  courses: optional_selectOptions,
});

export type BundleSchema = z.infer<typeof bundleSchema>;

export const bundleDefaultValues: BundleSchema | {} = {
  year: "",
  cycle: "",
  category: "",
  attendance: "",
  deadline: "",
  courses: [],
};

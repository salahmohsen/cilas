import { z } from "zod";

import { optional_file, optional_string } from "@/lib/utils/zodValidation.utils";

const blogSchema = {
  schema: z
    .object({
      isDraft: z.boolean(),
      slug: optional_string,
      enTitle: optional_string,
      arTitle: optional_string,
      enContent: optional_string,
      arContent: optional_string,
      excerpt: optional_string,
      featuredImage: optional_file,
      publishedAt: z.date().optional(),
    })
    .refine((data) => data.arTitle || data.enTitle, {
      path: ["enTitle"],
      message: "At least one English or Arabic title is required",
    })
    .refine((data) => data.enContent || data.arContent, {
      path: ["enContent"],
      message: "At least one English or Arabic content is required",
    })
    .refine((data) => data.arTitle || data.enTitle, {
      path: ["arTitle"],
      message: "At least one English or Arabic title is required.",
    })
    .refine((data) => data.enContent || data.arContent, {
      path: ["arContent"],
      message: "At least one English or Arabic content is required",
    }),
  defaults: {
    isDraft: true,
    slug: "",
    enTitle: "",
    arTitle: "",
    enContent: "",
    arContent: "",
    excerpt: "",
    featuredImage: "",
    publishedAt: new Date(),
  },
};

export type BlogSchema = z.infer<typeof blogSchema.schema>;
export default blogSchema;

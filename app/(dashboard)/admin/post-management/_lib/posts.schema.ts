import { z } from "zod";

import { file, string } from "@/lib/utils/zod.utils";

export const postSchema = {
  schema: z
    .object({
      isDraft: z.boolean(),
      slug: string().optional,
      enTitle: string().optional,
      arTitle: string().optional,
      enContent: string().optional,
      arContent: string().optional,
      excerpt: string().optional,
      featuredImage: file().optional,
      publishedAt: z.date().optional(),
      mainAuthorId: string().required,
      coAuthors: z.array(z.string()).optional(),
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
    mainAuthorId: "",
    coAuthors: [],
  },
};

export type PostSchema = z.infer<typeof postSchema.schema>;

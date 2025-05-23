import { postsTable } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import { PostsFilter } from "./posts.slice.types";

export const postsFilter = (filter: PostsFilter) => {
  switch (filter) {
    case PostsFilter.Published:
      return eq(postsTable.isDraft, false);

    case PostsFilter.Draft:
      return eq(postsTable.isDraft, true);
  }
};

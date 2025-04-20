"use server";

import db from "@/lib/db/drizzle";
import {
  authorToRoleTable,
  blogsToTagsTable,
  postsTable,
  postsToCategoriesTable,
} from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { PostsFilter } from "./posts.slice.types";
import { postsFilter } from "./utils";

export const fetchPosts = async (
  filter?: PostsFilter,
  id?: number,
  idArr?: number[],
  page: number = 1,
  pageSize: number = 10,
) => {
  const whereCondition =
    !filter && !id && !idArr
      ? undefined
      : idArr
        ? inArray(postsTable.id, idArr)
        : id !== undefined && filter !== undefined
          ? and(postsFilter(filter), eq(postsTable.id, id))
          : id !== undefined
            ? eq(postsTable.id, id)
            : filter !== undefined
              ? postsFilter(filter)
              : undefined;

  try {
    const rawPosts = await db.query.postsTable.findMany({
      with: { authors: true, tags: true, categories: true },
      where: whereCondition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(postsTable.createdAt)],
    });

    const posts = await Promise.all(
      rawPosts.map(async (post) => {
        const authors = await Promise.all(
          post.authors.map(async (author) => {
            const authorData = await db.query.authorToRoleTable.findFirst({
              where: eq(authorToRoleTable.roleId, author.roleId),
              columns: {},
              with: { role: true, author: true },
            });

            return {
              author: authorData?.author,
              role: authorData?.role,
              isMainAuthor: author.isMainAuthor,
            };
          }),
        );

        const categories = await Promise.all(
          post.categories.map(async (category) => {
            const result = await db.query.postsToCategoriesTable.findFirst({
              where: eq(postsToCategoriesTable.categoryId, category.categoryId),
              columns: undefined,
              with: { category: true },
            });
            const categoryResult = result?.category;
            return categoryResult;
          }),
        );
        const tags = await Promise.all(
          post.tags.map(async (tag) => {
            const result = await db.query.blogsToTagsTable.findFirst({
              where: eq(blogsToTagsTable.tagId, tag.tagId),
              with: { tag: true },
            });
            const tagResult = result?.tag;
            return tagResult;
          }),
        );

        return { ...post, authors, categories, tags };
      }),
    );

    return {
      success: true,
      message: "Posts fetched successfully",
      posts,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }

  return {
    error: true,
    message: "Unexpected error happened, please try again!",
  };
};

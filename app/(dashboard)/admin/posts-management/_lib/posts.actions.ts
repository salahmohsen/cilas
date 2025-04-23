"use server";

import db from "@/lib/drizzle/drizzle";
import {
  authorRolesTable,
  authorsTable,
  postCategoriesTable,
  postsTable,
  postsToCategoriesTable,
  postsToTagsTable,
  userTable,
} from "@/lib/drizzle/schema";
import blogTagsTable from "@/lib/drizzle/schema/post.tag";
import { serverActionStateBase } from "@/lib/types/server.actions";
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
    // Step 1: Get posts with pagination and filtering
    const rawPosts = await db.query.postsTable.findMany({
      where: whereCondition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(postsTable.createdAt)],
    });

    // Get all post IDs for batch fetching
    const postIds = rawPosts.map((post) => post.id);

    if (postIds.length === 0) {
      return {
        success: true,
        message: "No posts found",
        posts: [],
      };
    }

    // Step 2: Fetch all authors for these posts in a single query
    const allAuthors = await db
      .select({
        postId: authorsTable.postId,
        authorId: authorsTable.authorId,
        roleId: authorsTable.roleId,
        isMainAuthor: authorsTable.isMainAuthor,
        role: authorRolesTable,
        user: userTable,
      })
      .from(authorsTable)
      .leftJoin(authorRolesTable, eq(authorsTable.roleId, authorRolesTable.id))
      .leftJoin(userTable, eq(authorsTable.authorId, userTable.id))
      .where(inArray(authorsTable.postId, postIds));

    // Step 3: Fetch all categories for these posts in a single query
    const allCategories = await db
      .select({
        postId: postsToCategoriesTable.postId,
        category: postCategoriesTable,
      })
      .from(postsToCategoriesTable)
      .leftJoin(
        postCategoriesTable,
        eq(postsToCategoriesTable.categoryId, postCategoriesTable.id),
      )
      .where(inArray(postsToCategoriesTable.postId, postIds));

    // Step 4: Fetch all tags for these posts in a single query
    const allTags = await db
      .select({
        postId: postsToTagsTable.postId,
        tag: blogTagsTable,
      })
      .from(postsToTagsTable)
      .leftJoin(blogTagsTable, eq(postsToTagsTable.tagId, blogTagsTable.id))
      .where(inArray(postsToTagsTable.postId, postIds));

    // Step 5: Organize data by post
    const postsWithRelations = rawPosts.map((post) => {
      // Get authors for this post
      const postAuthors = allAuthors
        .filter((a) => a.postId === post.id)
        .map((authorData) => {
          if (!authorData.user) return null;
          const { passwordHash, googleId, ...safeAuthor } = authorData.user;

          return {
            user: { ...safeAuthor },
            role: authorData.role,
            isMainAuthor: authorData.isMainAuthor,
          };
        });

      // Get categories for this post
      const postCategories = allCategories
        .filter((c) => c.postId === post.id)
        .map((c) => c.category);

      // Get tags for this post
      const postTags = allTags.filter((t) => t.postId === post.id).map((t) => t.tag);

      return {
        ...post,
        authors: postAuthors,
        categories: postCategories,
        tags: postTags,
      };
    });

    return {
      success: true,
      message: "Posts fetched successfully",
      posts: postsWithRelations,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }

  return {
    error: true,
    message: "Unexpected error happened, please try again!",
  };
};

export const newPost = (
  prevState: serverActionStateBase,
  formData: FormData,
): Promise<serverActionStateBase> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: "Post created successfully",
      });
    }, 2000);
  });
};

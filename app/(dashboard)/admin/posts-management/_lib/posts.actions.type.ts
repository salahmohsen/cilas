import { fetchPosts } from "./posts.actions";

export type FetchPostsResult = Awaited<ReturnType<typeof fetchPosts>>;
export type Posts = (Awaited<ReturnType<typeof fetchPosts>> & { success: true })["posts"];
export type Post = Posts extends Array<infer T> ? T : never;

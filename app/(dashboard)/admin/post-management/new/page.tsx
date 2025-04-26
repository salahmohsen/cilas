import { ErrorPage } from "@/components/ui/error";
import { Suspense } from "react";
import Loading from "../../course-management/loading";
import { PostEditor } from "../_components/post.editor";
import { fetchPosts } from "../_lib/posts.actions";
import { Post } from "../_lib/posts.actions.type";

export default async function CreatePost({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const postId =
    typeof searchParams["duplicate"] === "string" ? searchParams["duplicate"] : undefined;

  let post: Post | undefined;
  let error: string | undefined;

  if (postId) {
    const errorMessage = `The post you're trying to duplicate does not exist or cannot be found. Please check the post ID and try again.`;

    try {
      const id = Number(postId);
      if (isNaN(id)) {
        throw new Error(errorMessage);
      }

      const result = await fetchPosts(undefined, id);
      if (!result || result.error || !result.posts?.length) {
        throw new Error(result.message || errorMessage);
      }

      post = result.posts[0];
    } catch (err) {
      error = err instanceof Error ? err.message : "An unexpected error occurred";
    }
  }

  if (error) {
    return <ErrorPage message={error} />;
  }

  return (
    <Suspense fallback={<Loading />}>
      <PostEditor post={post} postId={post?.id} />
    </Suspense>
  );
}

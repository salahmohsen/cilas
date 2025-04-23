import { deleteCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { toast } from "sonner";
import { create } from "zustand";
import { fetchPosts } from "./posts.actions";
import { PostsFilter, PostsState } from "./posts.slice.types";

export const usePostsStore = create<PostsState>((set, get) => ({
  activeTab: null,
  selectedPost: null,
  selectedSeries: null,
  postInfo: null,
  filter: PostsFilter.Published,
  author: undefined,
  isLoading: false,
  posts: null,
  series: null,

  // Simple actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedPost: (selected) => set({ selectedPost: selected }),
  setSelectedSeries: (selected) => set({ selectedSeries: selected }),
  setPostInfo: (post) => set({ postInfo: post }),
  setFilter: (filter) => set({ filter }),
  setAuthor: (author) => set({ author }),
  setLoading: (loading) => set({ isLoading: loading }),
  setPosts: (posts) => set({ posts, isLoading: false }),
  setSeries: (series) => set({ series, isLoading: false }),

  // Async actions
  getPosts: async () => {
    const filter = get().filter;
    if (!filter) {
      console.error("There is no filter to get posts!");
      return;
    }

    try {
      set({ isLoading: true });
      const data = await fetchPosts(filter);

      if (data.error) {
        throw new Error(data.message);
      }
      if (data.posts) {
        set({
          posts: data.posts,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch posts");
      set({ isLoading: false });
    }
  },

  revalidatePost: async (postID: number) => {
    try {
      set({ isLoading: true });
      const data = await fetchPosts(undefined, postID);
      if (data.error) {
        set({ isLoading: false });
        throw new Error(data.message);
      }
      if (data.posts) {
        const revalidatedPost = data.posts[0];
        const { posts } = get();

        // Check if the post data actually changed to avoid unnecessary updates
        const existingPost = posts?.find((post) => post.id === postID);
        if (JSON.stringify(existingPost) === JSON.stringify(data.posts[0])) {
          set({ isLoading: false });
          return;
        }

        const remainingPosts = posts?.filter((post) => post.id !== postID);
        const sortedPosts = [...(remainingPosts || []), revalidatedPost].sort((a, b) => {
          const startDateDiff =
            new Date(b.createdAt ?? "").getTime() - new Date(a.createdAt ?? "").getTime();
          if (startDateDiff !== 0) return startDateDiff;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // If startDates are the same, sort by createdAt
        });
        set({
          posts: sortedPosts,
          postInfo: revalidatedPost,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch post");
      set({ isLoading: false });
    }
  },

  getSeries: async () => {
    // try {
    //   set({ isLoading: true });
    //   const data = ;
    //   if (!data.success || !data.bundles) throw new Error(data.message);
    //   set({ series: data.bundles, isLoading: false });
    // } catch (error) {
    //   toast.error(error instanceof Error ? error.message : "Failed to fetch bundles");
    //   set({ isLoading: false });
    // }
  },

  handleDelete: async (postID) => {
    const { posts } = get();
    const originalPosts = posts;
    const postToDelete = posts?.find((post) => post.id === postID);
    if (!postToDelete) return toast.error("Post is not available!");

    const toastId = toast.loading("Loading...");

    try {
      // Optimistic update
      set({
        posts: posts?.filter((post) => post.id !== postID),
      });

      const formData = new FormData();
      formData.append("postID", postID.toString());
      const result = await deleteCourse({ message: "" }, formData);

      if (result.success) {
        toast.success(result.message, { id: toastId });
        set((state) => ({
          posts: state.posts?.filter((post) => post.id !== postID),
        }));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete post", {
        id: toastId,
      });
      // Restore the optimistic update
      set({ posts: originalPosts });
    }
  },
}));

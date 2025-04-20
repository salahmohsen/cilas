import { getBundles as fetchBundles } from "@/lib/actions/bundles.actions";
import { deleteCourse } from "@/lib/actions/courses.actions";
import { toast } from "sonner";
import { create } from "zustand";
import { fetchPosts } from "./posts.actions";
import { PostsFilter, PostsState } from "./posts.slice.types";

export const usePostsStore = create<PostsState>((set, get) => ({
  activeTab: null,
  isPostSelected: null,
  isSeriesSelected: null,
  postInfo: null,
  filter: PostsFilter.Published,
  author: undefined,
  isLoading: false,
  posts: null,
  series: null,

  // Simple actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setPostSelected: (selected) => set({ isPostSelected: selected }),
  setSeriesSelected: (selected) => set({ isSeriesSelected: selected }),
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
      console.error("There is no filter to get courses!");
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
      toast.error(error instanceof Error ? error.message : "Failed to fetch courses");
      set({ isLoading: false });
    }
  },

  revalidatePost: async (courseId: number) => {
    try {
      set({ isLoading: true });
      const data = await fetchPosts(undefined, courseId);
      if (data.error) {
        set({ isLoading: false });
        throw new Error(data.message);
      }
      if (data.posts) {
        const revalidatedCourse = data.posts[0];
        const { posts } = get();

        // Check if the course data actually changed to avoid unnecessary updates
        const existingPost = posts?.find((course) => course.id === courseId);
        if (JSON.stringify(existingPost) === JSON.stringify(data.posts[0])) {
          set({ isLoading: false });
          return;
        }

        const remainingCourses = posts?.filter((course) => course.id !== courseId);
        const sortedCourses = [...(remainingCourses || []), revalidatedCourse].sort(
          (a, b) => {
            const startDateDiff =
              new Date(b.createdAt ?? "").getTime() -
              new Date(a.createdAt ?? "").getTime();
            if (startDateDiff !== 0) return startDateDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // If startDates are the same, sort by createdAt
          },
        );
        set({
          posts: sortedCourses,
          postInfo: revalidatedCourse,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch course");
      set({ isLoading: false });
    }
  },

  getSeries: async () => {
    try {
      set({ isLoading: true });
      const data = await fetchBundles();

      if (!data.success || !data.bundles) throw new Error(data.message);
      set({ series: data.bundles, isLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch bundles");
      set({ isLoading: false });
    }
  },

  handleDelete: async (courseId) => {
    const { posts } = get();
    const originalCourses = posts;
    const courseToDelete = posts?.find((course) => course.id === courseId);
    if (!courseToDelete) return toast.error("Course is not available!");

    const toastId = toast.loading("Loading...");

    try {
      // Optimistic update
      set({
        posts: posts?.filter((course) => course.id !== courseId),
      });

      const formData = new FormData();
      formData.append("courseId", courseId.toString());
      const result = await deleteCourse({ message: "" }, formData);

      if (result.success) {
        toast.success(result.message, { id: toastId });
        set((state) => ({
          posts: state.posts?.filter((course) => course.id !== courseId),
        }));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete course", {
        id: toastId,
      });
      // Restore the optimistic update
      set({ posts: originalCourses });
    }
  },
}));

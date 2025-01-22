import { getBundles as fetchBundles } from "@/lib/actions/bundles.actions";
import { deleteCourse, fetchCourses } from "@/lib/actions/courses.actions";
import { toast } from "sonner";
import { create } from "zustand";
import { CourseState, CoursesFilter } from "../types/course.slice.types";

export const useCourseStore = create<CourseState>((set, get) => ({
  activeTab: null,
  isCourseSelected: null,
  isBundleSelected: null,
  courseInfo: null,
  filter: CoursesFilter.AllPublished,
  fellow: undefined,
  isLoading: false,
  courses: null,
  bundles: null,

  // Simple actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setCourseSelected: (selected) => set({ isCourseSelected: selected }),
  setBundleSelected: (selected) => set({ isBundleSelected: selected }),
  setCourseInfo: (course) => set({ courseInfo: course }),
  setFilter: (filter) => set({ filter }),
  setFellow: (fellow) => set({ fellow }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCourses: (courses) => set({ courses, isLoading: false }),
  setBundles: (bundles) => set({ bundles, isLoading: false }),

  // Async actions
  getCourses: async () => {
    const filter = get().filter;
    if (!filter) {
      console.error("There is no filter to get courses!");
      return;
    }

    try {
      set({ isLoading: true });
      const data = await fetchCourses(filter);

      if (data.error) {
        throw new Error(data.message);
      }
      if (data.courses) {
        set({
          courses: data.courses,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch courses");
      set({ isLoading: false });
    }
  },

  getBundles: async () => {
    try {
      set({ isLoading: true });
      const data = await fetchBundles();

      if (!data.success || !data.bundles) throw new Error(data.message);
      set({ bundles: data.bundles, isLoading: false });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch bundles");
      set({ isLoading: false });
    }
  },

  handleDelete: async (courseId) => {
    const { courses } = get();
    const originalCourses = courses;
    const courseToDelete = courses?.find((course) => course.id === courseId);
    if (!courseToDelete) return toast.error("Course is not available!");

    const toastId = toast.loading("Loading...");

    try {
      // Optimistic update
      set({
        courses: courses?.filter((course) => course.id !== courseId),
      });

      const formData = new FormData();
      formData.append("courseId", courseId.toString());
      const result = await deleteCourse({}, formData);

      if (result.success) {
        toast.success(result.message, { id: toastId });
        set((state) => ({
          courses: state.courses?.filter((course) => course.id !== courseId),
        }));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete course", {
        id: toastId,
      });
      // Restore the optimistic update
      set({ courses: originalCourses });
    }
  },
}));

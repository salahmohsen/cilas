import {
  deleteCourse,
  fetchPrivateCourse,
  fetchPrivateCourses,
} from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { toast } from "sonner";
import { create } from "zustand";
import { CourseState, CoursesFilter } from "./courses.slice.types";

export const useCourseStore = create<CourseState>((set, get) => ({
  activeTab: null,
  selectedCourse: null,
  courseInfo: null,
  filter: CoursesFilter.AllPublished,
  fellow: undefined,
  isLoading: false,
  courses: null,

  // Simple actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSelectedCourse: (selected) => set({ selectedCourse: selected }),
  setCourseInfo: (course) => set({ courseInfo: course }),
  setFilter: (filter) => set({ filter }),
  setFellow: (fellow) => set({ fellow }),
  setLoading: (loading) => set({ isLoading: loading }),
  setCourses: (courses) => set({ courses, isLoading: false }),

  // Async actions
  getCourses: async () => {
    const filter = get().filter;
    if (!filter) {
      console.error("There is no filter to get courses!");
      return;
    }

    try {
      set({ isLoading: true });
      const { success, error, data, message } = await fetchPrivateCourses({
        filter: filter,
      });

      if (error) {
        throw new Error(message);
      }
      if (success) {
        set({
          courses: data,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch courses");
      set({ isLoading: false });
    }
  },

  revalidateCourse: async (courseId: number) => {
    try {
      set({ isLoading: true });
      const { success, error, data, message } = await fetchPrivateCourse({
        id: courseId,
      });
      if (error || data === null) {
        set({ isLoading: false });
        throw new Error(message);
      }
      if (success && data !== null) {
        const revalidatedCourse = data;
        const { courses } = get();

        // Check if the course data actually changed to avoid unnecessary updates
        const existingCourse = courses?.find((course) => course.id === courseId);
        if (JSON.stringify(existingCourse) === JSON.stringify(data)) {
          set({ isLoading: false });
          return;
        }

        const remainingCourses = courses?.filter((course) => course.id !== courseId);
        const sortedCourses = [...(remainingCourses || []), revalidatedCourse].sort(
          (a, b) => {
            const startDateDiff =
              new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
            if (startDateDiff !== 0) return startDateDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // If startDates are the same, sort by createdAt
          },
        );
        set({
          courses: sortedCourses,
          courseInfo: revalidatedCourse,
          isLoading: false,
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch course");
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
      const result = await deleteCourse({ message: "" }, formData);

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

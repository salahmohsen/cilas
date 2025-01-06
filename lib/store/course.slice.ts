import { create } from 'zustand'
import { toast } from "sonner";
import { deleteCourse, getSafeCourses } from "@/lib/actions/courses.actions";
import { getBundles as fetchBundles } from "@/lib/actions/bundles.actions";
import {
  BundleWithCoursesNames,
  CourseWithSafeFellow,
  SafeUser,
} from "@/lib/types/drizzle.types";
import { CoursesFilter, Tab } from "@/lib/types/manage.courses.types";

interface CourseState {
  activeTab: Tab;
  isCourseSelected: Record<number, boolean> | null;
  isBundleSelected: Record<number, boolean> | null;
  courseInfo: CourseWithSafeFellow | undefined | null;
  filter: CoursesFilter;
  fellow: SafeUser | undefined;
  isLoading: boolean;
  courses: CourseWithSafeFellow[];
  bundles: BundleWithCoursesNames[];
  optimisticCourses: CourseWithSafeFellow[];
  isPending: boolean;

  // Actions
  setActiveTab: (tab: Tab) => void;
  setCourseSelected: (selected: Record<number, boolean> | null) => void;
  setBundleSelected: (selected: Record<number, boolean> | null) => void;
  setCourseInfo: (course: CourseWithSafeFellow | undefined | null) => void;
  setFilter: (filter: CoursesFilter) => void;
  setFellow: (fellow: SafeUser | undefined) => void;
  setLoading: (loading: boolean) => void;
  setCourses: (courses: CourseWithSafeFellow[]) => void;
  setBundles: (bundles: BundleWithCoursesNames[]) => void;
  deleteCourseFromState: (courseId: number) => void;
  setOptimisticCourses: (courses: CourseWithSafeFellow[]) => void;
  setIsPending: (isPending: boolean) => void;

  // Async actions
  getCourses: (filter: CoursesFilter) => Promise<void>;
  getBundles: () => Promise<void>;
  handleDelete: (courseId: number) => Promise<string | number | undefined>;
}

const useCourseStore = create<CourseState>((set, get) => ({
  activeTab: "published",
  isCourseSelected: null,
  isBundleSelected: null,
  courseInfo: null,
  filter: "published",
  fellow: undefined,
  isLoading: false,
  courses: [],
  bundles: [],
  optimisticCourses: [],
  isPending: false,

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
  deleteCourseFromState: (courseId) => 
    set((state) => ({
      courses: state.courses.filter((course) => course.id !== courseId)
    })),
  setOptimisticCourses: (courses) => set({ optimisticCourses: courses }),
  setIsPending: (isPending) => set({ isPending }),

  // Async actions
  getCourses: async (filter) => {
    const state = get();
    if (!state.filter) return;

    try {
      set({ courses: [], isLoading: true });
      const data = await getSafeCourses(filter);
      
      if (data.error) throw new Error(data.message);
      if (data.courses) {
        set({ courses: data.courses, isLoading: false });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch courses"
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch bundles"
      );
      set({ isLoading: false });
    }
  },

  handleDelete: async (courseId) => {
    
    const state = get();
    const courseToDelete = state.courses.find(
      (course) => course.id === courseId
    );
    if (!courseToDelete) return toast.error("Course is not available!");

    const toastId = toast.loading("Loading...");
    set({ isPending: true });

    try {
      // Optimistic update
      set({
        optimisticCourses: state.courses.filter(
          (course) => course.id !== courseId
        )
      });

      const formData = new FormData();
      formData.append("courseId", courseId.toString());
      const result = await deleteCourse({}, formData);

      if (result.success) {
        toast.success(result.message, { id: toastId });
        set((state) => ({
          courses: state.courses.filter((course) => course.id !== courseId)
        }));
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete course",
        { id: toastId }
      );
      // Restore the optimistic update
      set({ optimisticCourses: state.courses });
    } finally {
      set({ isPending: false });
    }
  },
}));

export default useCourseStore;
import {
  BundleWithCoursesNames,
  CourseWithSafeFellow,
  SafeUser,
} from "@/lib/types/drizzle.types";
import { CoursesFilter, Tab } from "@/lib/types/manage.courses.types";

export interface CourseState {
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

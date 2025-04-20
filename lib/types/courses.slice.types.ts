import {
  BundleWithCourseTitles,
  CourseWithFellowAndStudents,
  SafeUser,
} from "@/lib/types/drizzle.types";

export enum CoursesFilter {
  AllPublished = "all published",
  Archived = "archived",
  Ongoing = "ongoing",
  StartingSoon = "starting soon",
  Draft = "draft",
}
export enum CourseTabs {
  Published = "published",
  Draft = "draft",
}

export interface CourseState {
  activeTab: CourseTabs | null;
  isCourseSelected: Record<number, boolean> | null;
  isBundleSelected: Record<number, boolean> | null;
  courseInfo: CourseWithFellowAndStudents | null;
  filter: CoursesFilter;
  fellow: SafeUser | undefined;
  isLoading: boolean;
  courses: null | CourseWithFellowAndStudents[];
  bundles: null | BundleWithCourseTitles[];

  // Actions
  setActiveTab: (tab: CourseTabs) => void;
  setCourseSelected: (selected: Record<number, boolean> | null) => void;
  setBundleSelected: (selected: Record<number, boolean> | null) => void;
  setCourseInfo: (course: CourseWithFellowAndStudents | undefined | null) => void;
  setFilter: (filter: CoursesFilter) => void;
  setFellow: (fellow: SafeUser | undefined) => void;
  setLoading: (loading: boolean) => void;
  setCourses: (courses: CourseWithFellowAndStudents[]) => void;
  setBundles: (bundles: BundleWithCourseTitles[]) => void;
  revalidateCourse: (courseId: number) => Promise<void>;

  // Async actions
  getCourses: () => Promise<void>;
  getBundles: () => Promise<void>;
  handleDelete: (courseId: number) => Promise<string | number | undefined>;
}

import {
  BundleWithCourseTitles,
  CourseWithFellowAndStudents,
  userLocalInfo,
} from "@/lib/types/drizzle.types";

export enum CoursesFilter {
  AllPublished = "all published",
  Archived = "archived",
  Ongoing = "ongoing",
  StartingSoon = "starting soon",
  Draft = "draft",
}
export enum Tab {
  Published = "published",
  Draft = "draft",
  Bundles = "bundles",
}

export interface CourseState {
  activeTab: Tab | null;
  isCourseSelected: Record<number, boolean> | null;
  isBundleSelected: Record<number, boolean> | null;
  courseInfo: CourseWithFellowAndStudents | undefined | null;
  filter: CoursesFilter;
  fellow: userLocalInfo | undefined;
  isLoading: boolean;
  courses: null | CourseWithFellowAndStudents[];
  bundles: null | BundleWithCourseTitles[];

  // Actions
  setActiveTab: (tab: Tab) => void;
  setCourseSelected: (selected: Record<number, boolean> | null) => void;
  setBundleSelected: (selected: Record<number, boolean> | null) => void;
  setCourseInfo: (course: CourseWithFellowAndStudents | undefined | null) => void;
  setFilter: (filter: CoursesFilter) => void;
  setFellow: (fellow: userLocalInfo | undefined) => void;
  setLoading: (loading: boolean) => void;
  setCourses: (courses: CourseWithFellowAndStudents[]) => void;
  setBundles: (bundles: BundleWithCourseTitles[]) => void;
  revalidateCourse: (courseId: number) => Promise<void>;

  // Async actions
  getCourses: () => Promise<void>;
  getBundles: () => Promise<void>;
  handleDelete: (courseId: number) => Promise<string | number | undefined>;
}

import { SafeUser } from "@/lib/users/users.actions.types";
import { PrivateCourse } from "./courses.actions.types";

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
  selectedCourse: Record<number, boolean> | null;
  courseInfo: PrivateCourse | null;
  filter: CoursesFilter;
  fellow: SafeUser | undefined;
  isLoading: boolean;
  courses: null | PrivateCourse[];

  // Actions
  setActiveTab: (tab: CourseTabs) => void;
  setSelectedCourse: (selected: Record<number, boolean> | null) => void;
  setCourseInfo: (course: PrivateCourse | undefined | null) => void;
  setFilter: (filter: CoursesFilter) => void;
  setFellow: (fellow: SafeUser | undefined) => void;
  setLoading: (loading: boolean) => void;
  setCourses: (courses: PrivateCourse[]) => void;
  revalidateCourse: (courseId: number) => Promise<void>;

  // Async actions
  getCourses: () => Promise<void>;
  handleDelete: (courseId: number) => Promise<string | number | undefined>;
}

"use client";

import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { GetSafeCourses, getSafeCourses } from "@/actions/courses.actions";
import {
  CoursesFilter,
  CourseWithFellow,
  SafeUser,
} from "@/types/drizzle.types";
import { toast } from "sonner";
import {
  getBundles as fetchBundles,
  Bundle,
  GetBundles,
} from "@/actions/bundles.actions";
import { useSearchParams } from "next/navigation";

type IsSelected = { [key: number]: boolean | undefined };

type CourseStateContext = {
  courses: CourseWithFellow[] | undefined;
  setCourses: Dispatch<SetStateAction<CourseWithFellow[] | undefined>>;
  isCourseSelected: IsSelected;
  setIsCourseSelected: Dispatch<SetStateAction<IsSelected>>;
  isBundleSelected: IsSelected;
  setIsBundleSelected: Dispatch<SetStateAction<IsSelected>>;
  courseInfo: CourseWithFellow | undefined;
  setCourseInfo: Dispatch<SetStateAction<CourseWithFellow | undefined>>;
  filter: CoursesFilter;
  setFilter: Dispatch<SetStateAction<CoursesFilter>>;
  fellow: SafeUser | undefined;
  setFellow: Dispatch<SetStateAction<SafeUser | undefined>>;
  isLoading: boolean;
  bundles: Bundle[];
  forceUpdate: () => void;
};

const CourseStateContext = createContext<CourseStateContext>(
  {} as CourseStateContext,
);

export const CourseStateProvider = ({ children }) => {
  const searchParam = useSearchParams();
  const param = searchParam?.get("course_mode");

  const [isCourseSelected, setIsCourseSelected] = useState<IsSelected>({});
  const [isBundleSelected, setIsBundleSelected] = useState<IsSelected>({});

  const [courseInfo, setCourseInfo] = useState<CourseWithFellow | undefined>(
    undefined,
  );
  const [fellow, setFellow] = useState<SafeUser | undefined>(undefined);
  const [filter, setFilter] = useState<CoursesFilter>(
    (param as CoursesFilter) || "published", // this will first check param if there is a filter.. if not it will load the default published
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseWithFellow[] | undefined>(
    undefined,
  );

  const [bundles, setBundles] = useState<Bundle[]>([]);

  const forceUpdate = () => {
    getCourses();
  };

  // fetch courses data
  const getCourses = useCallback(async () => {
    if (!filter) return;
    try {
      setIsLoading(true);
      let data: GetSafeCourses;
      data = await getSafeCourses(filter);
      if (!data.error) setCourses(data.safeCourses);
      if (data.error) throw new Error(data.message);
    } catch (error) {
      if (error instanceof Error) toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // fetch courses bundles
  const getBundles = useCallback(async () => {
    let data: GetBundles;
    try {
      setIsLoading(true);
      data = await fetchBundles();
      if (data.success && data.bundles) {
        setBundles(data.bundles);
      } else {
        throw new Error(data.message);
      }
    } catch (e) {
      if (e instanceof Error) toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter === "bundles") getBundles();
  }, [getBundles, filter]);

  useEffect(() => {
    if (filter !== "bundles") getCourses();
  }, [getCourses, filter]);

  const contextValue: CourseStateContext = {
    isCourseSelected,
    setIsCourseSelected,
    isBundleSelected,
    setIsBundleSelected,
    courseInfo,
    setCourseInfo,
    filter,
    setFilter,
    isLoading,
    fellow,
    setFellow,
    bundles,
    courses,
    setCourses,
    forceUpdate,
  };
  return (
    <CourseStateContext.Provider value={contextValue}>
      {children}
    </CourseStateContext.Provider>
  );
};

export const useCourseState = (): CourseStateContext => {
  const courseStateContext = useContext(CourseStateContext);
  if (!courseStateContext)
    throw new Error("useCourseState must be used within course state context.");
  return courseStateContext;
};

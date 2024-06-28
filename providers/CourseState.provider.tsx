"use client";

import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { getCourses } from "@/actions/courses.actions";
import { CoursesFilter, DbCourse, DbCourses } from "@/types/drizzle.types";
import { toast } from "sonner";

type IsSelected = { [key: number]: boolean };

type CourseStateContext = {
  isSelected: IsSelected;
  setIsSelected: Dispatch<SetStateAction<IsSelected>>;
  courseInfo: DbCourse | null;
  setCourseInfo: Dispatch<SetStateAction<DbCourse | null>>;
  courseFilter: CoursesFilter;
  setCourseFilter: Dispatch<SetStateAction<CoursesFilter>>;
  courses: DbCourses;
  isLoading: boolean;
};

const CourseStateContext = createContext<CourseStateContext>(
  {} as CourseStateContext,
);

export const CourseStateProvider = ({ children }) => {
  const [isSelected, setIsSelected] = useState<IsSelected>({});
  const [courseInfo, setCourseInfo] = useState<DbCourse | null>(null);
  const [courseFilter, setCourseFilter] =
    useState<CoursesFilter>("all published");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<DbCourses>([]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const coursesData = await getCourses(courseFilter);
        setCourses(coursesData);
      } catch (error) {
        toast.error("Error fetching courses");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [courseFilter]);

  const contextValue: CourseStateContext = {
    isSelected: isSelected,
    setIsSelected: setIsSelected,
    courseInfo,
    setCourseInfo,
    courseFilter,
    setCourseFilter,
    courses,
    isLoading,
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

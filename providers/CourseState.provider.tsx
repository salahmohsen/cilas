"use client";

import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
  useOptimistic,
  useTransition,
  useCallback,
} from "react";
import { useFormState } from "react-dom";
import { getCourses } from "@/actions/courses.actions";
import { deleteCourse } from "@/actions/courses.actions";
import {
  CoursesFilter,
  CourseWithFellow,
  SafeUser,
} from "@/types/drizzle.types";
import { toast } from "sonner";

type IsSelected = { [key: number]: boolean | undefined };

type CourseStateContext = {
  isSelected: IsSelected;
  setIsSelected: Dispatch<SetStateAction<IsSelected>>;
  fetchCourses: (insertedId?: number) => Promise<void>;
  course: CourseWithFellow | null;
  setCourse: Dispatch<SetStateAction<CourseWithFellow | null>>;
  courseFilter: CoursesFilter;
  setCourseFilter: Dispatch<SetStateAction<CoursesFilter>>;
  courses: CourseWithFellow[];
  isLoading: boolean;
  handleDelete: (courseId: number) => void;
  fellow: SafeUser | undefined;
  setFellow: Dispatch<SetStateAction<SafeUser | undefined>>;
};

const CourseStateContext = createContext<CourseStateContext>(
  {} as CourseStateContext,
);

export const CourseStateProvider = ({ children }) => {
  const [isPending, startTransition] = useTransition();
  const [isSelected, setIsSelected] = useState<IsSelected>({});
  const [course, setCourse] = useState<CourseWithFellow | null>(null);
  const [fellow, setFellow] = useState<SafeUser | undefined>(undefined);
  const [courseFilter, setCourseFilter] =
    useState<CoursesFilter>("all published");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseWithFellow[]>([]);

  // fetch courses data
  const fetchCourses = useCallback(
    async (insertedId?: number) => {
      try {
        setIsLoading(true);
        const coursesData = await getCourses(courseFilter);
        setCourses(coursesData);
        if (insertedId) {
          const newCourse = coursesData.find((c) => c.id === insertedId);
          if (newCourse) {
            setCourse(newCourse);
            setIsSelected({ [insertedId]: true });
          }
        }
      } catch (error) {
        toast.error("Error fetching courses");
      } finally {
        setIsLoading(false);
      }
    },
    [courseFilter],
  );

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Delete Course
  const [deleteState, deleteAction] = useFormState(deleteCourse, {});

  const [optimisticCourses, addOptimisticCourse] = useOptimistic(
    courses,
    (currentState, courseIdToRemove: number) => {
      return currentState.filter((course) => course.id !== courseIdToRemove);
    },
  );

  const handleDelete = (courseId: number) => {
    startTransition(() => {
      addOptimisticCourse(courseId);
      const formData = new FormData();
      formData.append("courseId", courseId.toString());
      deleteAction(formData);
    });
  };

  useEffect(() => {
    if (deleteState?.success) {
      toast.success(deleteState.message);
      setCourses((current) =>
        current.filter(
          (course) => course.id !== Number(deleteState?.deletedId),
        ),
      );
    }
    if (deleteState?.error) toast.error(deleteState.message);
  }, [deleteState]);

  const contextValue: CourseStateContext = {
    isSelected: isSelected,
    setIsSelected: setIsSelected,
    fetchCourses,
    course,
    setCourse,
    courseFilter,
    setCourseFilter,
    courses: optimisticCourses,
    isLoading,
    handleDelete,
    fellow,
    setFellow,
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

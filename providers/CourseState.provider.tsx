"use client";

import {
  Dispatch,
  SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
  useOptimistic,
  useRef,
  useTransition,
} from "react";
import { deleteCourse, getSafeCourses } from "@/actions/courses.actions";
import { BundleWithCoursesNames, CourseWithSafeFellow, SafeUser } from "@/types/drizzle.types";
import { toast } from "sonner";
import { getBundles as fetchBundles } from "@/actions/bundles.actions";
import { useSearchParams } from "next/navigation";
import { useFormState } from "react-dom";
import { CoursesFilter, Tab } from "@/types/manage.courses.types";

type IsSelected = Record<number, boolean> | undefined;

type CourseStateContext = {
  optimisticCourses: CourseWithSafeFellow[] | undefined;
  setCourses: Dispatch<SetStateAction<CourseWithSafeFellow[] | undefined>>;
  isCourseSelected: IsSelected;
  setIsCourseSelected: Dispatch<SetStateAction<IsSelected>>;
  isBundleSelected: IsSelected;
  setIsBundleSelected: Dispatch<SetStateAction<IsSelected>>;
  courseInfo: CourseWithSafeFellow | undefined;
  setCourseInfo: Dispatch<SetStateAction<CourseWithSafeFellow | undefined>>;
  filter: CoursesFilter;
  setFilter: Dispatch<SetStateAction<CoursesFilter>>;
  fellow: SafeUser | undefined;
  setFellow: Dispatch<SetStateAction<SafeUser | undefined>>;
  isLoading: boolean;
  bundles: BundleWithCoursesNames[];
  forceUpdateCourses: () => Promise<void>;
  forceUpdateBundles: () => Promise<void>;
  handleDelete: (courseId: number) => void;
  activeTab: Tab;
  setActiveTab: Dispatch<SetStateAction<Tab>>;
};

const CourseStateContext = createContext<CourseStateContext | undefined>(undefined);

export const CourseStateProvider = ({ children }: { children: ReactNode }) => {
  const [activeTab, setActiveTab] = useState<Tab>("published");
  const [isCourseSelected, setIsCourseSelected] = useState<IsSelected>(undefined);
  const [isBundleSelected, setIsBundleSelected] = useState<IsSelected>(undefined);
  const [courseInfo, setCourseInfo] = useState<CourseWithSafeFellow | undefined>(undefined);
  const [fellow, setFellow] = useState<SafeUser | undefined>(undefined);

  // this will first check param if there is a filter.. if not it will load the default published
  const [filter, setFilter] = useState<CoursesFilter>("published");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [courses, setCourses] = useState<CourseWithSafeFellow[] | undefined>(undefined);

  const [bundles, setBundles] = useState<BundleWithCoursesNames[]>([]);

  // fetch courses data
  const getCourses = useCallback(async () => {
    if (!filter) return;
    try {
      setIsLoading(true);
      const data = await getSafeCourses(filter);
      if (data.error) throw new Error(data.message);
      setCourses(data.courses);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch courses");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  // fetch courses bundles
  const getBundles = useCallback(async () => {
    console.log("fetching bundles runned!");
    try {
      setIsLoading(true);
      const data = await fetchBundles();

      if (!data.success || !data.bundles) throw new Error(data.message);
      setBundles(data.bundles);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch bundles");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const forceUpdateCourses = useCallback(async () => await getCourses(), [getCourses]);

  const forceUpdateBundles = useCallback(async () => await getBundles(), [getBundles]);

  useEffect(() => {
    if (activeTab === "bundles") getBundles();
  }, [getBundles, activeTab]);

  useEffect(() => {
    getCourses();
  }, [getCourses, filter]);

  //*************************************************************************************** Delete Course

  const [deleteState, deleteAction] = useFormState(deleteCourse, {});
  const [isPending, startTransition] = useTransition();

  const [optimisticCourses, addOptimisticCourse] = useOptimistic(courses, (currentState, courseIdToRemove: number) => {
    if (currentState) return currentState.filter((course) => course.id !== courseIdToRemove);
  });

  const handleDelete = useCallback(
    (courseId: number) => {
      startTransition(() => {
        addOptimisticCourse(courseId);
        const formData = new FormData();
        formData.append("courseId", courseId.toString());
        deleteAction(formData);
      });
    },
    [addOptimisticCourse, deleteAction],
  );
  const toastId = useRef<string | number>();
  useEffect(() => {
    if (isPending) toastId.current = toast.loading("Loading...");
  }, [isPending]);

  useEffect(() => {
    if (deleteState?.success) {
      toast.success(deleteState.message, { id: toastId.current });
      setCourses((current) => current?.filter((course) => course.id !== Number(deleteState?.deletedId)));
    }
    if (deleteState?.error) toast.error(deleteState.message);
  }, [deleteState, setCourses, toastId]);

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
    optimisticCourses,
    setCourses,
    forceUpdateCourses,
    forceUpdateBundles,
    handleDelete,
    activeTab,
    setActiveTab,
  };
  return <CourseStateContext.Provider value={contextValue}>{children}</CourseStateContext.Provider>;
};

export const useCourseState = (): CourseStateContext => {
  const context = useContext(CourseStateContext);
  if (!context) throw new Error("useCourseState must be used within course state context.");
  return context;
};

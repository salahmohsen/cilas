"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  ReactNode,
  useOptimistic,
  useRef,
  useTransition,
  useReducer,
} from "react";
import { deleteCourse, getSafeCourses } from "@/actions/courses.actions";
import {
  BundleWithCoursesNames,
  CourseWithSafeFellow,
  SafeUser,
} from "@/types/drizzle.types";
import { toast } from "sonner";
import { getBundles as fetchBundles } from "@/actions/bundles.actions";
import { useFormState } from "react-dom";
import { CoursesFilter, Tab } from "@/types/manage.courses.types";

type State = {
  activeTab: Tab;
  isCourseSelected: Record<number, boolean> | undefined;
  isBundleSelected: Record<number, boolean> | undefined;
  courseInfo: CourseWithSafeFellow | undefined;
  filter: CoursesFilter;
  fellow: SafeUser | undefined;
  isLoading: boolean;
  courses: CourseWithSafeFellow[];
  bundles: BundleWithCoursesNames[];
};

type Action =
  | { type: "SET_ACTIVE_TAB"; payload: Tab }
  | {
      type: "SET_COURSE_SELECTED";
      payload: Record<number, boolean> | undefined;
    }
  | {
      type: "SET_BUNDLE_SELECTED";
      payload: Record<number, boolean> | undefined;
    }
  | { type: "SET_COURSE_INFO"; payload: CourseWithSafeFellow | undefined }
  | { type: "SET_FILTER"; payload: CoursesFilter }
  | { type: "SET_FELLOW"; payload: SafeUser | undefined }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_COURSES"; payload: CourseWithSafeFellow[] }
  | { type: "SET_BUNDLES"; payload: BundleWithCoursesNames[] }
  | { type: "DELETE_COURSE"; payload: number };

const initialState: State = {
  activeTab: "published",
  isCourseSelected: undefined,
  isBundleSelected: undefined,
  courseInfo: undefined,
  filter: "published",
  fellow: undefined,
  isLoading: false,
  courses: [],
  bundles: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_ACTIVE_TAB":
      return { ...state, activeTab: action.payload };
    case "SET_COURSE_SELECTED":
      return { ...state, isCourseSelected: action.payload };
    case "SET_BUNDLE_SELECTED":
      return { ...state, isBundleSelected: action.payload };
    case "SET_COURSE_INFO":
      return { ...state, courseInfo: action.payload };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    case "SET_FELLOW":
      return { ...state, fellow: action.payload };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "SET_COURSES":
      return { ...state, courses: action.payload };
    case "SET_BUNDLES":
      return { ...state, bundles: action.payload };
    case "DELETE_COURSE":
      return {
        ...state,
        courses: state.courses?.filter(
          (course) => course.id !== action.payload,
        ),
      };
    default:
      return state;
  }
}

const CourseStateContext = createContext<
  | {
      state: State;
      dispatch: React.Dispatch<Action>;
      optimisticCourses: CourseWithSafeFellow[];
      forceUpdateCourses: () => Promise<void>;
      forceUpdateBundles: () => Promise<void>;
      handleDelete: (courseId: number) => void;
    }
  | undefined
>(undefined);

export const CourseStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [deleteState, deleteAction] = useFormState(deleteCourse, {});
  const [isPending, startTransition] = useTransition();

  const [optimisticCourses, addOptimisticCourse] = useOptimistic(
    state.courses,
    (currentState, courseIdToRemove: number | null) => {
      return currentState.filter((course) => course.id !== courseIdToRemove);
    },
  );

  const getCourses = useCallback(async () => {
    if (!state.filter) return;

    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const data = await getSafeCourses(state.filter);
      if (data.error) throw new Error(data.message);
      if (data.courses) {
        dispatch({ type: "SET_COURSES", payload: data.courses });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch courses",
      );
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.filter]);

  const getBundles = useCallback(async () => {
    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const data = await fetchBundles();

      if (!data.success || !data.bundles) throw new Error(data.message);
      dispatch({ type: "SET_BUNDLES", payload: data.bundles });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to fetch bundles",
      );
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  const forceUpdateCourses = useCallback(async () => {
    await getCourses();
  }, [getCourses]);

  const forceUpdateBundles = useCallback(async () => {
    await getBundles();
  }, [getBundles]);

  useEffect(() => {
    if (state.activeTab === "bundles") getBundles();
  }, [getBundles, state.activeTab]);

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
      dispatch({
        type: "DELETE_COURSE",
        payload: Number(deleteState?.deletedId),
      });
    }
    if (deleteState?.error) toast.error(deleteState.message);
  }, [deleteState]);

  useEffect(() => {
    getCourses();
  }, [getCourses, state.filter]);

  return (
    <CourseStateContext.Provider
      value={{
        state,
        dispatch,
        optimisticCourses,
        forceUpdateCourses,
        forceUpdateBundles,
        handleDelete,
      }}
    >
      {children}
    </CourseStateContext.Provider>
  );
};

export const useCourseState = () => {
  const context = useContext(CourseStateContext);
  if (!context)
    throw new Error("useCourseState must be used within course state context.");
  return context;
};

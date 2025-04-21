import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { createEditCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { CourseTabs } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { isObjectEmpty } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import courseSchema, { CourseSchema } from "./course.schema";
import { CourseFormState } from "./courses.actions.types";

// Define types first
type LoadingState = {
  primaryButton: boolean;
  secondaryButton: boolean;
};

type UseCourseFormProps = {
  courseData: CourseWithFellowAndStudents | undefined;
  editMode: boolean;
  courseId: number | undefined;
};

export const CourseFormContext = createContext<unknown>(null);

export const useCourseFormContext = () => {
  const context = useContext(CourseFormContext);
  if (!context) {
    throw new Error("useCourseFormContext must be used within a CourseFormProvider");
  }
  return context;
};

export const useCourseForm = ({ courseData, editMode, courseId }: UseCourseFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  const { getCourses, setActiveTab } = useCourseStore();

  // set draft mode base on courseData passed to the component
  const [draftMode, setDraftMode] = useState<boolean>(courseData?.draftMode ?? false);

  const activeTab = draftMode ? CourseTabs.Draft : CourseTabs.Published;

  // set separate loading for each button: Publish | Draft
  const [isLoading, setIsLoading] = useState<LoadingState>({
    primaryButton: false,
    secondaryButton: false,
  });

  // using transition to use isPending. @note: useFormStatus will not work.
  const [isPending, startTransition] = useTransition();

  // Setup useFormState for creating/editing course
  const [courseState, courseAction] = useFormState(
    createEditCourse,
    {} as CourseFormState,
  );

  // Setup Course Form with Zod Validation
  const formMethods = useForm<CourseSchema>({
    resolver: zodResolver(courseSchema.schema),
    mode: "onChange",
    defaultValues: {
      ...courseSchema.defaults,
      ...((courseData as CourseSchema) ?? {}),
    },
  });

  // Handle course state
  useEffect(() => {
    // @success
    if (courseState.success) {
      toast.success(courseState.message);
      getCourses();
      // Redirect based on course submit mode: published | draft
      setActiveTab(activeTab);

      redirect("/admin/course-management?tab=" + activeTab);
    }
    // @error
    if (courseState.error) toast.error(courseState.message);

    // stop loading
    if (!isPending && (courseState.success || courseState.error))
      setIsLoading({ primaryButton: false, secondaryButton: false });
  }, [activeTab, courseState, draftMode, getCourses, isPending, setActiveTab]);

  const handleSubmit = useCallback(
    (draftMode: boolean) => {
      // Start loading if there is no errors
      if (isObjectEmpty(formMethods.formState.errors))
        setIsLoading((prev) => ({
          ...prev,
          [draftMode ? "secondaryButton" : "primaryButton"]: true,
        }));
      // establish courseAction
      startTransition(() => {
        // create formData object and append draftMode, editMode, and courseId
        const formData = new FormData(formRef.current!);
        formData.append("draftMode", draftMode.toString());
        formData.append("editMode", editMode.toString());
        if (courseId) formData.append("courseId", courseId.toString());
        courseAction(formData);
      });
    },
    [formMethods.formState.errors, editMode, courseId, courseAction],
  );

  const CourseFormProvider = ({ children }: { children: ReactNode }) => {
    const contextValue = {
      formRef,
      formMethods,
      isLoading,
      handleSubmit,
      draftMode,
      setDraftMode,
      courseAction,
    };

    return (
      <CourseFormContext.Provider value={contextValue}>
        {children}
      </CourseFormContext.Provider>
    );
  };

  return {
    // CourseFormProvider,
    formRef,
    formMethods,
    isLoading,
    handleSubmit,
    draftMode,
    setDraftMode,
    courseAction,
  };
};

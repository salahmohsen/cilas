import {
  CourseFormState,
  createEditCourse,
} from "@/lib/actions/courses.actions";
import { useCourseStore } from "@/lib/store/course.slice";
import {
  courseFormDefaultValues,
  CourseSchema,
  courseSchema,
} from "@/lib/types/course.schema";
import { CourseWithSafeFellow } from "@/lib/types/drizzle.types";
import { isObjectEmpty } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type LoadingState = {
  primaryButton: boolean;
  secondaryButton: boolean;
};

type UseCourseFormProps = {
  courseData: CourseWithSafeFellow | undefined;
  editMode: boolean;
  courseId: number | undefined;
};

export const useCourseForm = ({
  courseData,
  editMode,
  courseId,
}: UseCourseFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  const { forceUpdateCourses, setActiveTab } = useCourseStore();

  // set draft mode base on courseData passed to the component
  const [draftMode, setDraftMode] = useState<boolean>(
    courseData?.draftMode ?? false,
  );

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
    resolver: zodResolver(courseSchema),
    mode: "onChange",
    defaultValues: {
      ...courseFormDefaultValues,
      ...((courseData as CourseSchema) ?? {}),
    },
  });
  // Handle course state
  useEffect(() => {
    // @success
    if (courseState.success) {
      toast.success(courseState.message);
      forceUpdateCourses();
      // Redirect based on course submit mode: published | draft
      setActiveTab(draftMode ? "draft" : "published");

      redirect(
        "/admin/course-management?tab=" + (draftMode ? "draft" : "published"),
      );
    }
    // @error
    if (courseState.error) toast.error(courseState.message);

    // stop loading
    if (!isPending && (courseState.success || courseState.error))
      setIsLoading({ primaryButton: false, secondaryButton: false });
  }, [courseState, draftMode, forceUpdateCourses, isPending, setActiveTab]);

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

  return {
    formRef,
    formMethods,
    isLoading,
    handleSubmit,
    draftMode,
    setDraftMode,
    courseAction,
  };
};

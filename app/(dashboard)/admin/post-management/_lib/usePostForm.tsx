import { createEditCourse } from "@/app/(dashboard)/admin/course-management/_lib/courses.actions";
import { CourseTabs } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { isObjectEmpty } from "@/lib/utils/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "next/navigation";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CourseFormState } from "../../course-management/_lib/courses.actions.types";
import { Post } from "./posts.actions.type";
import { postSchema, PostSchema } from "./posts.schema";
import { usePostsStore } from "./posts.slice";

// Define types first
type LoadingState = {
  primaryButton: boolean;
  secondaryButton: boolean;
};

type usePostFormProps = {
  post: Post | undefined;
  editMode: boolean;
  courseId: number | undefined;
};

export const usePostForm = ({ post, editMode, courseId }: usePostFormProps) => {
  const formRef = useRef<HTMLFormElement>(null);

  const { getPosts, setActiveTab } = usePostsStore();

  // set draft mode base on courseData passed to the component
  const [draftMode, setDraftMode] = useState<boolean>(post?.isDraft ?? false);

  const activeTab = draftMode ? CourseTabs.Draft : CourseTabs.Published;

  // set separate loading for each button: Publish | Draft
  const [isLoading, setIsLoading] = useState<LoadingState>({
    primaryButton: false,
    secondaryButton: false,
  });

  // using transition to use isPending. @note: useFormStatus will not work.
  const [isPending, startTransition] = useTransition();

  // Setup useFormState for creating/editing course
  const [postState, postAction] = useFormState(createEditCourse, {} as CourseFormState);

  // Setup Course Form with Zod Validation
  const formMethods = useForm<PostSchema>({
    resolver: zodResolver(postSchema.schema),
    mode: "onChange",
    defaultValues: {
      ...postSchema.defaults,
      ...((post as PostSchema) ?? {}),
    },
  });

  // Handle course state
  useEffect(() => {
    // @success
    if (postState.success) {
      toast.success(postState.message);
      getPosts();
      // Redirect based on course submit mode: published | draft
      setActiveTab(activeTab);

      redirect("/admin/course-management?tab=" + activeTab);
    }
    // @error
    if (postState.error) toast.error(postState.message);

    // stop loading
    if (!isPending && (postState.success || postState.error))
      setIsLoading({ primaryButton: false, secondaryButton: false });
  }, [activeTab, postState, draftMode, getPosts, isPending, setActiveTab]);

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
        postAction(formData);
      });
    },
    [formMethods.formState.errors, editMode, courseId, postAction],
  );

  return {
    // CourseFormProvider,
    formRef,
    formMethods,
    isLoading,
    handleSubmit,
    draftMode,
    setDraftMode,
    courseAction: postAction,
  };
};

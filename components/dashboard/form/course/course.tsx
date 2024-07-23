"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { CourseFormState, createEditCourse } from "@/actions/courses.actions";

import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  courseFormDefaultValues,
  CourseSchema,
  courseSchema,
} from "@/types/course.schema";

import { Form } from "@/components/ui/form";
import { CourseMetadata } from "./section.meta";

import { toast } from "sonner";
import { redirect } from "next/navigation";
import { isObjectEmpty } from "@/lib/utils";

import { SafeUser } from "@/types/drizzle.types";
import { useCourseState } from "@/providers/CourseState.provider";
import { BlockEditor } from "@/tipTap/components/BlockEditor";
import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { JSONContent } from "@tiptap/core";
import { SubmitButtons } from "./submit.buttons";
import { EditorHeader } from "@/tipTap/components/EditorHeader";

type LoadingState = {
  primaryButton: boolean;
  secondaryButton: boolean;
};

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?: CourseSchema & { draftMode: boolean; fellow: SafeUser };
  courseId?: number;
  initialContent?: JSONContent;
};

export function CourseForm({
  editMode = false,
  courseData,
  courseId,
  initialContent,
}: CourseFormPropTypes) {
  if (editMode && (!courseData || !courseId))
    throw new Error("course data or course id not provided");

  const formRef = useRef<HTMLFormElement>(null); // Form Refs

  const { dispatch, forceUpdateCourses } = useCourseState();

  const [draftMode, setDraftMode] = useState<boolean>(
    courseData?.draftMode ?? false,
  ); // set draft mode base on courseData passed to the component

  const [isLoading, setIsLoading] = useState<LoadingState>({
    primaryButton: false,
    secondaryButton: false,
  }); // set separate loading for each button: Publish | Draft

  const [isPending, startTransition] = useTransition(); // using transition to use isPending. @note: useFormStatus will not work.

  const [courseState, courseAction] = useFormState(
    createEditCourse,
    {} as CourseFormState,
  ); // Setup useFormState for creating/editing course

  const formMethods = useForm<CourseSchema>({
    resolver: zodResolver(courseSchema),
    mode: "onChange",

    defaultValues: {
      ...courseFormDefaultValues,
      ...(courseData ?? {}),
    },
  }); // Setup Course Form with Zod Validation

  // Handle course state
  useEffect(() => {
    // @success
    if (courseState.success) {
      toast.success(courseState.message);
      forceUpdateCourses();
      // Redirect based on course submit mode: published | draft
      dispatch({
        type: "SET_ACTIVE_TAB",
        payload: draftMode ? "draft" : "published",
      });
      redirect(
        "/dashboard/course-management?tab=" +
          (draftMode ? "draft" : "published"),
      );
    }
    // @error
    if (courseState.error) toast.error(courseState.message);

    // stop loading
    if (!isPending && (courseState.success || courseState.error))
      setIsLoading({ primaryButton: false, secondaryButton: false });
  }, [courseState, draftMode, forceUpdateCourses, isPending, dispatch]);

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

  const [content, setContent] = useState<JSONContent | undefined>(
    initialContent,
  );

  const { editor, characterCount, leftSidebar } = useBlockEditor({
    defaultSidebarOpen: true,
    content,
    setContent,
  });

  console.log(formMethods.watch());

  return (
    <FormProvider {...formMethods}>
      <EditorHeader
        characters={characterCount.characters()}
        words={characterCount.words()}
        isSidebarOpen={leftSidebar.isOpen}
        toggleSidebar={leftSidebar.toggle}
        submitButtons={
          <SubmitButtons
            isLoading={isLoading}
            editMode={editMode}
            draftMode={draftMode}
            setDraftMode={setDraftMode}
          />
        }
      />
      <Form {...formMethods}>
        <form
          ref={formRef}
          action={courseAction}
          onSubmit={(e) => {
            e.preventDefault();
            formMethods.handleSubmit(() => {
              handleSubmit(draftMode);
            })(e); // immediately invokes the handleSubmit with the original event object.
          }}
        >
          <BlockEditor editor={editor} leftSidebar={leftSidebar}>
            <input
              hidden
              name="content"
              value={JSON.stringify(content)}
              onChange={setContent}
            />
            <CourseMetadata editMode={editMode} fellow={courseData?.fellow} />
          </BlockEditor>
        </form>
      </Form>
    </FormProvider>
  );
}

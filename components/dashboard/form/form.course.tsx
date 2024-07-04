"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { CourseFormState, createEditCourse } from "@/actions/courses.actions";

import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { courseFormDefaultValues, courseSchema } from "@/types/course.schema";

import { Form } from "@/components/ui/form";
import { CourseContent } from "./form.course.section.content";
import { CourseMetadata } from "./form.course.section.meta";
import { SubmitButton } from "@/components/dashboard/form/form.input.submit";

import { toast } from "sonner";
import { redirect } from "next/navigation";
import { isObjectEmpty } from "@/lib/utils";

import { SafeUser } from "@/types/drizzle.types";
import { useCourseState } from "@/providers/CourseState.provider";

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?:
    | (z.infer<typeof courseSchema> & { draftMode: boolean } & {
        fellow: SafeUser;
      })
    | undefined;
  courseId?: number;
};
export function CourseForm({
  editMode = false,
  courseData,
  courseId,
}: CourseFormPropTypes) {
  if (editMode && (!courseData || !courseId))
    throw new Error("course data or course id not provided");

  // Form Refs
  const formRef = useRef<HTMLFormElement>(null);

  const { setCourseFilter, fetchCourses, setIsSelected } = useCourseState();

  // set draft mode base on courseData passed to the component
  const [draftMode, setDraftMode] = useState<boolean>(
    courseData?.draftMode ?? false,
  );

  // set separate loading for each button: Publish | Draft
  const [isLoading, setIsLoading] = useState<{
    primaryButton: boolean;
    secondaryButton: boolean;
  }>({ primaryButton: false, secondaryButton: false });

  // using transition to use isPending. @note: useFormStatus will not work.
  const [isPending, startTransition] = useTransition();

  // Setup useFormState for creating/editing course
  const [courseState, courseAction] = useFormState(
    createEditCourse,
    {} as CourseFormState,
  );

  // Setup Zod Validation
  const formMethods = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    mode: "onChange",

    defaultValues: {
      ...courseFormDefaultValues,
      ...(courseData ?? {}),
    },
  });

  // Handle course state
  useEffect(() => {
    // @success
    if (courseState.success) {
      toast.success(courseState.message);
      fetchCourses(courseState.courseId); // trigger refetching

      // Redirect based on course submit mode: published | draft
      redirect(
        "/dashboard/courses?course_mode=" + (draftMode ? "draft" : "published"),
      );
    }
    // @error
    if (courseState.error) toast.error(courseState.message);

    // stop loading
    if (!isPending && (courseState.success || courseState.error))
      setIsLoading({ primaryButton: false, secondaryButton: false });
  }, [
    courseState,
    isPending,
    draftMode,
    setCourseFilter,
    fetchCourses,
    setIsSelected,
  ]);

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
        // set course filter which will determine which tab content will load after redirect
        draftMode ? setCourseFilter("draft") : setCourseFilter("all published");
        // create formData object and append draftMode, editMode, and courseId
        const formData = new FormData(formRef.current!);
        formData.append("draftMode", draftMode.toString());
        formData.append("editMode", editMode.toString());
        if (courseId) formData.append("courseId", courseId.toString());
        courseAction(formData);
      });
    },
    [
      formMethods.formState.errors,
      setCourseFilter,
      editMode,
      courseId,
      courseAction,
    ],
  );

  return (
    <>
      <FormProvider {...formMethods}>
        <main className="mx-0 xl:mx-32">
          <div className="grid w-full items-start gap-10">
            <Form {...formMethods}>
              <form
                ref={formRef}
                className="space-y-8"
                action={courseAction}
                onSubmit={(e) => {
                  e.preventDefault();
                  formMethods.handleSubmit(() => {
                    handleSubmit(draftMode);
                  })(e); // immediately invokes the handleSubmit with the original event object.
                }}
              >
                <CourseContent />
                <CourseMetadata
                  editMode={editMode}
                  fellow={courseData?.fellow}
                />
                <div className="flex gap-5">
                  <SubmitButton
                    isLoading={isLoading.secondaryButton}
                    value="Save Draft"
                    className="!mb-5"
                    variant="secondary"
                    handleOnClick={() => setDraftMode(true)}
                  />

                  <SubmitButton
                    variant="default"
                    isLoading={isLoading.primaryButton}
                    value={
                      editMode && !draftMode ? "Save Changes" : "Publish Course"
                    }
                    className="!mb-5"
                    handleOnClick={() => setDraftMode(false)}
                  />
                </div>
              </form>
            </Form>
          </div>
        </main>
      </FormProvider>
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { createCourse } from "@/actions/courses.actions";

import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  courseFormDefaultValues,
  courseSchema,
} from "@/types/courseForm.schema";

import { Form } from "@/components/ui/form";
import CourseContent from "./ContentSection";
import CourseMetadata from "./MetadataSection";
import { SubmitButton } from "./inputs/SubmitButton";

import { toast } from "sonner";
import { redirect } from "next/navigation";
import { isObjectEmpty } from "@/lib/utils";

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?: z.infer<typeof courseSchema> & { draftMode: boolean };
  courseId?: number;
};
export default function CourseForm({
  editMode = false,
  courseData,
  courseId,
}: CourseFormPropTypes) {
  if (editMode && (!courseData || !courseId))
    throw new Error("course data or course id not provided");
  const formRef = useRef<HTMLFormElement>(null);

  const [draftMode, setDraftMode] = useState<boolean>(
    courseData?.draftMode ?? false,
  );
  const [isLoading, setIsLoading] = useState<{
    primaryButton: boolean;
    secondaryButton: boolean;
  }>({ primaryButton: false, secondaryButton: false });

  const [createCourseState, createCourseAction] = useFormState(
    createCourse.bind(null, draftMode, editMode, courseId),
    {
      isPending: true, // initial state of isPending
    },
  );

  const formMethods = useForm<z.infer<typeof courseSchema>>({
    resolver: zodResolver(courseSchema),
    progressive: false,
    mode: "onChange",
    defaultValues: {
      ...courseFormDefaultValues,
      ...(courseData ?? {}),
    },
  });

  useEffect(() => {
    if (!createCourseState.isPending)
      setIsLoading({ primaryButton: false, secondaryButton: false });
    if (createCourseState.success) toast.success(createCourseState.success);
    if (createCourseState.error) toast.error(createCourseState.error);
    if (!createCourseState.isPending && createCourseState.success)
      redirect("/dashboard/courses");
  }, [createCourseState]);

  const handleSubmit = useCallback(
    (isDraft: boolean) => {
      if (isObjectEmpty(formMethods.formState.errors))
        setIsLoading((prev) => ({
          ...prev,
          [isDraft ? "secondaryButton" : "primaryButton"]: true,
        }));

      const formData = new FormData(formRef.current!);

      createCourseAction(formData);
    },
    [createCourseAction, formMethods.formState.errors],
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
                action={createCourseAction}
                onSubmit={(e) => {
                  e.preventDefault();
                  formMethods.handleSubmit(() => {
                    handleSubmit(draftMode);
                  })(e);
                }}
              >
                <CourseContent />
                <CourseMetadata
                  editMode={editMode}
                  authorId={courseData?.authorId}
                />
                <div className="flex gap-5">
                  <SubmitButton
                    isLoading={isLoading.secondaryButton}
                    value={
                      editMode && !draftMode ? "convert to Draft" : "Save Draft"
                    }
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

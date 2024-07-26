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

import { CourseWithSafeFellow } from "@/types/drizzle.types";
import { useCourseState } from "@/providers/CourseState.provider";
import { BlockEditor } from "@/tipTap/components/BlockEditor";
import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { SubmitButtons } from "./submit.buttons";
import { EditorHeader } from "@/tipTap/components/EditorHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentInput } from "../inputs/input.content";
import { JSONContent } from "@tiptap/core";

type LoadingState = {
  primaryButton: boolean;
  secondaryButton: boolean;
};

type ActiveContentTab = "enContent" | "arContent";

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?: CourseWithSafeFellow;
  courseId?: number;
};

export function CourseForm({
  editMode = false,
  courseData,
  courseId,
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
      ...((courseData as CourseSchema) ?? {}),
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

  const [enContent, setEnContent] = useState<JSONContent | undefined>(
    courseData?.enContent as JSONContent,
  );

  const [arContent, setArContent] = useState<JSONContent | undefined>(
    courseData?.arContent as JSONContent,
  );

  const [sidebarActiveTab, setSidebarActiveTab] = useState<string>("form");

  const {
    editor: enEditor,
    characterCount: enCharacterCount,
    leftSidebar: enLeftSidebar,
  } = useBlockEditor({
    defaultSidebarOpen: true,
    content: enContent,
    setContent: setEnContent,
  });

  const {
    editor: arEditor,
    characterCount: arCharacterCount,
    leftSidebar: arLeftSidebar,
  } = useBlockEditor({
    defaultSidebarOpen: true,
    content: arContent,
    setContent: setArContent,
  });

  const defaultActiveTab = useCallback((): ActiveContentTab => {
    const arContent = courseData?.arContent?.content?.length ?? 0;
    const enContent = courseData?.enContent?.content?.length ?? 0;
    const defaultTab = arContent > enContent ? "arContent" : "enContent";
    return defaultTab;
  }, [courseData?.arContent, courseData?.enContent]);

  const [activeContentTab, setActiveContentTab] =
    useState<ActiveContentTab>(defaultActiveTab());

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
    enLeftSidebar.toggle();
    arLeftSidebar.toggle();
  }, [enLeftSidebar, arLeftSidebar]);

  return (
    <FormProvider {...formMethods}>
      <Form {...formMethods}>
        <form
          className="w-full"
          ref={formRef}
          action={courseAction}
          onSubmit={(e) => {
            e.preventDefault();
            formMethods.handleSubmit(() => {
              handleSubmit(draftMode);
            })(e); // immediately invokes the handleSubmit with the original event object.
          }}
        >
          <EditorHeader
            characters={
              activeContentTab === "enContent"
                ? enCharacterCount.characters()
                : arCharacterCount.characters()
            }
            words={
              activeContentTab === "enContent"
                ? enCharacterCount.words()
                : arCharacterCount.words()
            }
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            submitButtons={
              <SubmitButtons
                isLoading={isLoading}
                editMode={editMode}
                draftMode={draftMode}
                setDraftMode={setDraftMode}
              />
            }
          />

          <Tabs
            value={activeContentTab}
            onValueChange={setActiveContentTab as (string) => void}
            className={`relative pt-16 transition-all duration-300 ${enLeftSidebar.isOpen ? "sm:w-2/3" : "sm:w-full"} `}
          >
            <TabsList
              className={`absolute w-full rounded-none ${enLeftSidebar.isOpen && "sm:shadow-insetRight"} `}
            >
              <TabsTrigger value="enContent">English Content</TabsTrigger>
              <TabsTrigger value="arContent">Arabic Content</TabsTrigger>
            </TabsList>
            <TabsContent value="enContent">
              <BlockEditor
                editor={enEditor}
                leftSidebar={enLeftSidebar}
                sidebarActiveTab={sidebarActiveTab}
                setSidebarActiveTab={setSidebarActiveTab}
              >
                <CourseMetadata
                  editMode={editMode}
                  fellow={courseData?.fellow}
                />
              </BlockEditor>
            </TabsContent>
            <TabsContent value="arContent">
              <BlockEditor
                editor={arEditor}
                leftSidebar={arLeftSidebar}
                sidebarActiveTab={sidebarActiveTab}
                setSidebarActiveTab={setSidebarActiveTab}
              >
                <CourseMetadata
                  editMode={editMode}
                  fellow={courseData?.fellow}
                />
              </BlockEditor>
            </TabsContent>
          </Tabs>
          <ContentInput
            titleName="arTitle"
            contentName="arContent"
            content={arContent}
          />
          <ContentInput
            titleName="enTitle"
            contentName="enContent"
            content={enContent}
          />
        </form>
      </Form>
    </FormProvider>
  );
}

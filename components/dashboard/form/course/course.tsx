"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form } from "@/components/ui/form";
import { FormProvider } from "react-hook-form";

import { CourseMetadata } from "./section.meta";

import { BlockEditor } from "@/lib/tiptap/components/BlockEditor";
import { EditorHeader } from "@/lib/tiptap/components/EditorHeader";
import { SubmitButtons } from "./submit.buttons";
import { ContentInput } from "../inputs/";
import {
  useCourseForm,
  useCourseEditor,
  useCourseTab,
  useCourseSidebar,
} from "./course.hooks";
import { CourseWithSafeFellow } from "@/lib/types/drizzle.types";

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

  const {
    formRef,
    formMethods,
    isLoading,
    handleSubmit,
    draftMode,
    setDraftMode,
    courseAction,
  } = useCourseForm({ courseData, editMode, courseId });

  const {
    enEditor,
    arEditor,
    arContent,
    enContent,
    enCharacterCount,
    arCharacterCount,
    enLeftSidebar,
    arLeftSidebar,
    sidebarActiveTab,
    setSidebarActiveTab,
  } = useCourseEditor({ courseData });

  const { activeContentTab, setActiveContentTab } = useCourseTab({
    courseData,
  });

  const { isSidebarOpen, toggleSidebar } = useCourseSidebar({
    enLeftSidebar,
    arLeftSidebar,
  });

  return (
    <FormProvider {...formMethods}>
      <Form {...formMethods}>
        <form
          className="w-full"
          ref={formRef}
          action={courseAction}
          onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
            const nativeEvent = e.nativeEvent as SubmitEvent;
            const submitter = (nativeEvent.submitter as HTMLButtonElement)
              .classList;
            /*@note: This is a workaround to prevent the form from submitting when 
            clicking on any button other than "Publish Course" || "Draft Button" button.*/
            if (submitter.contains("submit-btn")) {
              e.preventDefault();
              formMethods.handleSubmit(() => {
                handleSubmit(draftMode);
              })(e); // immediately invokes the handleSubmit with the original event object.
            } else {
              e.preventDefault();
            }
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

"use client";

import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { CourseMeta } from "./course.meta";

import { ContentInput } from "@/components/form-inputs";
import {
  useCourseEditor,
  useCourseForm,
  useCourseSidebar,
  useCourseTab,
} from "@/lib/hooks/courses";
import { BlockEditor } from "@/lib/tiptap/components/BlockEditor";
import { EditorHeader } from "@/lib/tiptap/components/EditorHeader";
import { CourseWithFellowAndStudents } from "@/lib/types/drizzle.types";
import { ContentName, TitleName } from "@/lib/types/editor";
import { SubmitButtons } from "./submit.buttons";

type CourseFormPropTypes = {
  editMode?: boolean;
  courseData?: CourseWithFellowAndStudents;
  courseId?: number;
};

export function CourseEditor({
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
    // CourseFormProvider,
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
    <Form {...formMethods}>
      <form
        className="relative h-[94vh] w-full overflow-hidden!"
        ref={formRef}
        action={courseAction}
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
          const nativeEvent = e.nativeEvent as SubmitEvent;
          const submitter = (nativeEvent.submitter as HTMLButtonElement).classList;
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
        >
          <SubmitButtons
            isLoading={isLoading}
            editMode={editMode}
            draftMode={draftMode}
            setDraftMode={setDraftMode}
          />
        </EditorHeader>
        {/* <CourseFormProvider> */}
        <Tabs
          value={activeContentTab}
          onValueChange={setActiveContentTab as (string) => void}
          className={`relative h-16 pt-10 duration-300`}
        >
          <TabsList
            className={`bg-accent absolute left-0 h-10 w-full rounded-none border-b p-0 transition-all ${enLeftSidebar.isOpen && "sm:shadow-insetRight w-3/4"} `}
          >
            <TabsTrigger
              value="enContent"
              className={
                "data-[state=active]:bg-background h-full w-full border-0 shadow-none data-[state=inactive]:cursor-pointer"
              }
            >
              English Content
            </TabsTrigger>
            <TabsTrigger
              value="arContent"
              className={
                "data-[state=active]:bg-background h-full w-full border-0 shadow-none data-[state=inactive]:cursor-pointer"
              }
            >
              Arabic Content
            </TabsTrigger>
          </TabsList>
          <TabsContent value="enContent" className="mt-0">
            <BlockEditor
              editor={enEditor}
              leftSidebar={enLeftSidebar}
              sidebarActiveTab={sidebarActiveTab}
              setSidebarActiveTab={setSidebarActiveTab}
            >
              <CourseMeta editMode={editMode} fellow={courseData?.fellow} />
            </BlockEditor>
          </TabsContent>
          <TabsContent value="arContent" className="mt-0">
            <BlockEditor
              editor={arEditor}
              leftSidebar={arLeftSidebar}
              sidebarActiveTab={sidebarActiveTab}
              setSidebarActiveTab={setSidebarActiveTab}
            >
              <CourseMeta editMode={editMode} fellow={courseData?.fellow} />
            </BlockEditor>
          </TabsContent>
        </Tabs>
        {/* </CourseFormProvider> */}
        <ContentInput
          titleName={TitleName.ar}
          contentName={ContentName.ar}
          content={arContent}
        />
        <ContentInput
          titleName={TitleName.en}
          contentName={ContentName.en}
          content={enContent}
        />
      </form>
    </Form>
  );
}

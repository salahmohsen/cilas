"use client";

import { ContentInput } from "@/components/form-inputs";
import { FormWrapper } from "@/components/form-inputs/form.wrapper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { newPost } from "@/lib/actions/blog.actions";
import { useCourseSidebar } from "@/lib/hooks/courses";
import { BlockEditor } from "@/lib/tiptap/components/BlockEditor";
import { EditorHeader } from "@/lib/tiptap/components/EditorHeader";
import { useBlockEditor } from "@/lib/tiptap/hooks/useBlockEditor";
import { ContentName, EditorSidebar, TitleName } from "@/lib/types/editor";
import { BlogSchema, blogSchema } from "@/lib/types/form.schema";
import { serverActionStateBase } from "@/lib/types/server.actions";
import { zodResolver } from "@hookform/resolvers/zod";
import { JSONContent } from "@tiptap/core";
import { redirect } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { SubmitButtons } from "../../course-management/_components/courses/editor/submit.buttons";
import BlogMeta from "./blog.meta";

export default function BlogEditor() {
  const formMethods = useForm<BlogSchema>({
    mode: "onBlur",
    resolver: zodResolver(blogSchema.schema),
    defaultValues: blogSchema.defaults,
  });

  const [activeContentTab, setActiveContentTab] = useState<ContentName>(ContentName.en);
  const [enContent, setEnContent] = useState<JSONContent | undefined>(undefined);
  const [arContent, setArContent] = useState<JSONContent | undefined>(undefined);

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

  const [sidebarActiveTab, setSidebarActiveTab] = useState<EditorSidebar>(
    EditorSidebar.form,
  );

  const { isSidebarOpen, toggleSidebar } = useCourseSidebar({
    enLeftSidebar,
    arLeftSidebar,
  });

  return (
    <FormWrapper<BlogSchema, serverActionStateBase>
      formMethods={formMethods}
      serverAction={newPost}
      onSuccess={() => redirect("/dashboard/admin/blog-management")}
    >
      {({ isPending }) => (
        <>
          <EditorHeader
            characters={
              activeContentTab === ContentName.en
                ? enCharacterCount.characters()
                : arCharacterCount.characters()
            }
            words={
              activeContentTab === ContentName.ar
                ? enCharacterCount.words()
                : arCharacterCount.words()
            }
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            submitButtons={
              <SubmitButtons
                isLoading={{ primaryButton: false, secondaryButton: false }}
                editMode={false}
                draftMode={false}
                setDraftMode={() => {}}
              />
            }
          />

          <Tabs
            value={activeContentTab}
            onValueChange={setActiveContentTab as (val: string) => void}
            className={`relative pt-16 transition-all duration-300 ${enLeftSidebar.isOpen ? "sm:w-2/3" : "sm:w-full"}`}
          >
            <TabsList
              className={`absolute w-full rounded-none ${enLeftSidebar.isOpen && "sm:shadow-insetRight"}`}
            >
              <TabsTrigger value={ContentName.en}>English Content</TabsTrigger>
              <TabsTrigger value={ContentName.ar}>Arabic Content</TabsTrigger>
            </TabsList>
            <TabsContent value={ContentName.en}>
              <BlockEditor
                editor={enEditor}
                leftSidebar={enLeftSidebar}
                sidebarActiveTab={sidebarActiveTab}
                setSidebarActiveTab={setSidebarActiveTab}
              >
                <BlogMeta formMethods={formMethods} />
              </BlockEditor>
            </TabsContent>
            <TabsContent value={ContentName.ar}>
              <BlockEditor
                editor={arEditor}
                leftSidebar={arLeftSidebar}
                sidebarActiveTab={sidebarActiveTab}
                setSidebarActiveTab={setSidebarActiveTab}
              >
                {/* <CourseMetadata editMode={editMode} fellow={courseData?.fellow} /> */}
              </BlockEditor>
            </TabsContent>
          </Tabs>
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
        </>
      )}
    </FormWrapper>
  );
}

"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { BlockEditor } from "@/lib/tiptap/components/BlockEditor";
import { EditorHeader } from "@/lib/tiptap/components/EditorHeader";
import { SubmitButtons } from "../../course-management/_components/courses/editor/submit.buttons";
import { Post } from "../_lib/posts.actions.type";
import { usePostEditor } from "../_lib/usePostEditor";
import { usePostSidebar } from "../_lib/usePostSidebar";
import { usePostTab } from "../_lib/usePostTab";
import PostMeta from "./post.meta";

type PostEditorProps = {
  editMode?: boolean;
  post?: Post;
  postId?: number;
};

export const PostEditor = ({ editMode = false, post, postId }: PostEditorProps) => {
  if (editMode && (!post || !postId))
    throw new Error("post data or post id not provided");

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
  } = usePostEditor({ post });

  const { isSidebarOpen, toggleSidebar } = usePostSidebar({
    enLeftSidebar,
    arLeftSidebar,
  });

  const { activeContentTab, setActiveContentTab } = usePostTab({ post });

  return (
    <form
      className="relative h-[94vh] w-full overflow-hidden!"
      onSubmit={(e: React.FormEvent<HTMLFormElement>) => {}}
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
          isLoading={{ primaryButton: false, secondaryButton: false }}
          editMode={editMode}
          draftMode={false}
          setDraftMode={() => false}
        />
      </EditorHeader>
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
            English version
          </TabsTrigger>
          <TabsTrigger
            value="arContent"
            className={
              "data-[state=active]:bg-background h-full w-full border-0 shadow-none data-[state=inactive]:cursor-pointer"
            }
          >
            Arabic version
          </TabsTrigger>
        </TabsList>
        <TabsContent value="enContent" className="mt-0">
          <BlockEditor
            editor={enEditor}
            leftSidebar={enLeftSidebar}
            sidebarActiveTab={sidebarActiveTab}
            setSidebarActiveTab={setSidebarActiveTab}
          >
            <PostMeta />
          </BlockEditor>
        </TabsContent>
        <TabsContent value="arContent" className="mt-0">
          <BlockEditor
            editor={arEditor}
            leftSidebar={arLeftSidebar}
            sidebarActiveTab={sidebarActiveTab}
            setSidebarActiveTab={setSidebarActiveTab}
          >
            عربي
          </BlockEditor>
        </TabsContent>
      </Tabs>
    </form>
  );
};

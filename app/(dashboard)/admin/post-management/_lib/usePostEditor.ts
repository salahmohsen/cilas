import { EditorSidebar } from "@/app/(dashboard)/_lib/tiptap.types";
import { useBlockEditor } from "@/lib/tiptap/hooks/useBlockEditor";
import { JSONContent as TipTapJSONContent } from "@tiptap/core";
import { useState } from "react";
import { Post } from "./posts.actions.type";

type usePostEditorProps = { post: Post | undefined };
type JSONContent = TipTapJSONContent | undefined;

export const usePostEditor = ({ post }: usePostEditorProps) => {
  const [sidebarActiveTab, setSidebarActiveTab] = useState<EditorSidebar>(
    EditorSidebar.form,
  );

  const [enContent, setEnContent] = useState<JSONContent>(post?.enContent as JSONContent);
  const [arContent, setArContent] = useState<JSONContent>(post?.arContent as JSONContent);

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

  return {
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
  };
};

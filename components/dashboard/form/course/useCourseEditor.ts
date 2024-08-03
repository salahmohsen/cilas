import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { CourseWithSafeFellow } from "@/types/drizzle.types";
import { JSONContent as TipTapJSONContent } from "@tiptap/core";
import { useState } from "react";

type UseCourseEditorProps = { courseData: CourseWithSafeFellow | undefined };
type JSONContent = TipTapJSONContent | undefined;

export const useCourseEditor = ({ courseData }: UseCourseEditorProps) => {
  const [sidebarActiveTab, setSidebarActiveTab] = useState<string>("form");

  const [enContent, setEnContent] = useState<JSONContent>(
    courseData?.enContent as JSONContent,
  );

  const [arContent, setArContent] = useState<JSONContent>(
    courseData?.arContent as JSONContent,
  );

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

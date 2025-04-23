import { EditorSidebar } from "@/app/(dashboard)/_lib/tiptap.types";
import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { useBlockEditor } from "@/lib/tiptap/hooks/useBlockEditor";
import { JSONContent as TipTapJSONContent } from "@tiptap/core";
import { useState } from "react";

type UseCourseEditorProps = { courseData: CourseWithFellowAndStudents | undefined };
type JSONContent = TipTapJSONContent | undefined;

export const useCourseEditor = ({ courseData }: UseCourseEditorProps) => {
  const [sidebarActiveTab, setSidebarActiveTab] = useState<EditorSidebar>(
    EditorSidebar.form,
  );

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

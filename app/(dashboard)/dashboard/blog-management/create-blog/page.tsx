"use client";

import { BlockEditor } from "@/tipTap/components/BlockEditor";
import "@/tipTap/styles/index.css";
import "@/app/editor.css";
import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { initialContent } from "@/tipTap/lib/data/course.initialContent";

export default function CreateBlog() {
  const { editor, content, characterCount, leftSidebar } = useBlockEditor({
    initialContent: initialContent,
    defaultSidebarOpen: true,
  });

  return (
    <BlockEditor
      editor={editor}
      characterCount={characterCount}
      leftSidebar={leftSidebar}
    >
      Form
    </BlockEditor>
  );
}

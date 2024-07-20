"use client";

import { BlockEditor } from "@/tipTap/components/BlockEditor";
import "@/tipTap/styles/index.css";
import "@/app/editor.css";
import { Button } from "@/components/ui/button";
import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { initialContent } from "@/tipTap/lib/data/initialContent";
import { EditorHeader } from "@/tipTap/components/EditorHeader";

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
      Test Test Test Test{" "}
    </BlockEditor>
  );
}

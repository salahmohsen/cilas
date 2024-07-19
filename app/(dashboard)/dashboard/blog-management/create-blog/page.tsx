"use client";

import { BlockEditor } from "@/tipTap/components/BlockEditor";
import "@/tipTap/styles/index.css";
import "@/app/editor.css";
import { Button } from "@/components/ui/button";
import { useBlockEditor } from "@/tipTap/hooks/useBlockEditor";
import { initialContent } from "@/tipTap/lib/data/initialContent";

export default function CreateBlog() {
  const { editor, content, characterCount, leftSidebar } =
    useBlockEditor(initialContent);
  console.log(content);
  return (
    <BlockEditor
      editor={editor}
      characterCount={characterCount}
      leftSidebar={leftSidebar}
    >
      <Button>Hello</Button>
    </BlockEditor>
  );
}

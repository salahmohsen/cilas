import { Editor, JSONContent, useEditor } from "@tiptap/react";

import { ExtensionKit } from "@/tipTap/extensions/extension-kit";
import { useSidebar } from "./useSidebar";
import { initialContent } from "@/tipTap/lib/data/initialContent";
import { useState } from "react";

declare global {
  interface Window {
    editor: Editor | null;
  }
}

export const useBlockEditor = () => {
  const leftSidebar = useSidebar();
  const [content, setContent] = useState<JSONContent[]>();
  console.log(content);
  const editor = useEditor(
    {
      autofocus: true,
      onCreate: ({ editor }) => {
        if (editor.isEmpty) {
          editor.commands.setContent(initialContent);
        }
      },
      onUpdate: ({ editor }) => {
        setContent(editor.getHTML());
      },
      extensions: [...ExtensionKit()],
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
          class: "min-h-full",
        },
      },
    },
    [],
  );

  const characterCount = editor?.storage.characterCount || {
    characters: () => 0,
    words: () => 0,
  };

  return { editor, characterCount, leftSidebar };
};

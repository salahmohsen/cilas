import { Editor, JSONContent, useEditor } from "@tiptap/react";

import { ExtensionKit } from "@/tipTap/extensions/extension-kit";
import { useSidebar } from "./useSidebar";
import { useState } from "react";

declare global {
  interface Window {
    editor: Editor | null;
  }
}

type useBlockEditorProps = {
  initialContent?: JSONContent;
  defaultSidebarOpen?: boolean;
};

export const useBlockEditor = ({
  initialContent,
  defaultSidebarOpen,
}: useBlockEditorProps) => {
  const leftSidebar = useSidebar(defaultSidebarOpen);
  const [content, setContent] = useState<JSONContent>();

  const editor = useEditor(
    {
      autofocus: true,
      onCreate: ({ editor }) => {
        if (editor.isEmpty && initialContent) {
          editor.commands.setContent(initialContent);
        }
      },
      onUpdate: ({ editor }) => {
        setContent(editor.getJSON());
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

  if (typeof window !== "undefined") window.editor = editor;

  return { editor, characterCount, leftSidebar, content };
};

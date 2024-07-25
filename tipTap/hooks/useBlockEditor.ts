import { Editor, JSONContent, useEditor } from "@tiptap/react";

import { ExtensionKit } from "@/tipTap/extensions/extension-kit";
import { useSidebar } from "./useSidebar";
import { Dispatch, SetStateAction } from "react";
import { textDirection } from "@/lib/tiptap-extensions";

type useBlockEditorProps = {
  defaultSidebarOpen?: boolean;
  content: JSONContent | undefined;
  setContent: Dispatch<SetStateAction<JSONContent | undefined>>;
};

export const useBlockEditor = ({
  defaultSidebarOpen,
  content,
  setContent,
}: useBlockEditorProps) => {
  const leftSidebar = useSidebar(defaultSidebarOpen);

  const editor = useEditor(
    {
      autofocus: true,
      onCreate: ({ editor }) => {
        if (editor.isEmpty && content) {
          editor.commands.setContent(content);
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

  return { editor, characterCount, leftSidebar, content };
};

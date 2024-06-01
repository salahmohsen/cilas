"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Youtube from "@tiptap/extension-youtube";
import EditorToolbar from "./TipTapEditorToolbar";

const TipTap = ({
  description,
  onChange,
  placeholder = "Write a description...",
}: {
  description: string;
  onChange: (richText: string) => void;
  placeholder?: string;
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          HTMLAttributes: { class: "text-xl font-bold", levels: [2] },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
        emptyNodeClass:
          "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none text-sm",
      }),
      Youtube.configure({}),
    ],
    content: description,
    editorProps: {
      attributes: {
        class:
          "rounded-md min-h-[150px] border border-input bg-background px-3 py-3 ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      console.log(editor.getHTML());
    },
  });
  return (
    <div className="flex min-h-[250px] flex-col justify-stretch gap-1">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default TipTap;

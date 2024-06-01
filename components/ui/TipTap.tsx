"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
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
        paragraph: { HTMLAttributes: { class: "prose-base" } },
        heading: {
          HTMLAttributes: {
            levels: [4],
            class: "prose-lg scroll-m-20 font-semibold tracking-tight",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class: "mx-6 my-6 border-l-2 pl-6 italic",
          },
        },
        bulletList: {
          HTMLAttributes: {
            class: "my-6 mx-6 list-disc [&>li]:mt-2",
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: "my-6 mx-6 list-decimal [&>li]:mt-2",
          },
        },
      }),
      Placeholder.configure({
        placeholder: placeholder,
        emptyNodeClass:
          "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none text-sm",
      }),
      Typography,
      Link.configure({
        HTMLAttributes: {
          class:
            "text-gray-600 hover:text-gray-500 underline underline-offset-4",
        },
        autolink: false,
      }),
    ],
    content: description,
    editorProps: {
      attributes: {
        class:
          "overflow-y-auto scrollbar-thin min-h-[150px] max-h-[300px] rounded-md border border-input bg-background px-3 py-3 ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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

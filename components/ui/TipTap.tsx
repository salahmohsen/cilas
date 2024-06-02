"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import Youtube from "@tiptap/extension-youtube";
import TextAlign from "@tiptap/extension-text-align";
import TextDirection from "tiptap-text-direction";

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
        paragraph: {
          HTMLAttributes: { class: "prose-base " },
        },
        heading: {
          HTMLAttributes: {
            levels: [4],
            class: "prose-lg scroll-m-20 font-semibold tracking-tight ",
          },
        },
        blockquote: {
          HTMLAttributes: {
            class:
              "mx-6 my-6 rounded-2xl border-l-2 bg-gray-100 p-5 pl-6 text-justify font-semibold italic leading-8 text-gray-700 shadow-sm",
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
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Youtube.configure({
        inline: false,
        width: 480,
        height: 320,
        nocookie: true,
        ccLanguage: "en",
        HTMLAttributes: {
          class:
            "float-right ml-6 rounded-md border border-input float bg-background px-3 py-3 ring-offset-2",
        },
      }),
      TextDirection.configure({
        types: ["heading", "paragraph", "blockquote"],
      }),
    ],
    content: description,
    editorProps: {
      attributes: {
        class:
          "overflow-y-auto scrollbar-thin min-h-[150px] rounded-md border border-input bg-background px-3 py-3 ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className="flex flex-col gap-1">
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default TipTap;

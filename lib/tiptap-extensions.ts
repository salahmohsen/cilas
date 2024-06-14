import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import TextDirection from "tiptap-text-direction";

// ToDo => Confifure classNames

export const starterKit = StarterKit.configure({
  paragraph: {
    HTMLAttributes: { class: "prose-base" },
  },

  heading: {
    HTMLAttributes: {
      levels: [4],
      class: "prose-lg scroll-m-20 font-semibold tracking-tight",
    },
  },

  blockquote: {
    HTMLAttributes: {
      class:
        "mx-6 my-6 rounded-2xl border-l-2 bg-gray-100 p-5 pl-6 text-justify font-semibold italic leading-8 text-gray-700 shadow-sm ",
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
});

export const placeholderExtension = Placeholder.configure({
  placeholder: "Change this text later",
  emptyNodeClass:
    "first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none text-sm",
});

export const typography = Typography;

export const link = Link.configure({
  HTMLAttributes: {
    class: "text-gray-600 hover:text-gray-500 underline underline-offset-4",
  },
  autolink: false,
});

export const textAlign = TextAlign.configure({
  types: ["heading", "paragraph"],
});

export const textDirection = TextDirection.configure({
  types: ["heading", "paragraph", "blockquote"],
});

export const editorProps = {
  attributes: {
    class:
      "overflow-y-auto scrollbar-thin min-h-[150px] rounded-md border border-input bg-background px-3 py-3 ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  },
};

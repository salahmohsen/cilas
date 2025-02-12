import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Typography from "@tiptap/extension-typography";
import StarterKit from "@tiptap/starter-kit";
import TextDirection from "tiptap-text-direction";

// ToDo => configure classNames

export const starterKit = StarterKit.configure({
  paragraph: {
    HTMLAttributes: { class: "prose-base" },
  },
  hardBreak: {
    HTMLAttributes: {
      keepMarks: false,
    },
  },
  heading: {
    HTMLAttributes: {
      levels: [3],
      class: " prose-h3:mt-10 scroll-m-20 text-lg font-semibold tracking-tight ",
    },
  },

  blockquote: {
    HTMLAttributes: {
      class:
        "mx-6 my-6 rounded-2xl border-l-2 bg-gray-100 p-5 pl-6 text-justify font-semibold italic leading-8 text-gray-700 shadow-xs ",
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

const DEFAULT_PLACEHOLDER = "Click here to start writing …";

export const placeholderExtension = (placeholder: string) => {
  return Placeholder.configure({
    placeholder: placeholder || DEFAULT_PLACEHOLDER,
    emptyNodeClass: `first:before:h-0 first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none text-sm`,
  });
};

export const typography = Typography;

export const link = Link.configure({
  HTMLAttributes: {
    class: "text-gray-600 hover:text-gray-500 underline underline-offset-4",
  },
  autolink: false,
  openOnClick: false,
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

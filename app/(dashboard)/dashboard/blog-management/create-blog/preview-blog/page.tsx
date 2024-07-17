// import { ExtensionKit } from "@/tipTap/extensions/extension-kit";
// import { initialContent } from "@/tipTap/lib/data/initialContent";
// import { EditorContent, generateHTML, useEditor } from "@tiptap/react";
// import "@/tipTap/styles/index.css";
// import StarterKit from "@tiptap/starter-kit";
// import Emoji, { emojis } from "@tiptap-pro/extension-emoji";
// import Link from "@tiptap/extension-link";
// import TextStyle from "@tiptap/extension-text-style";
// import Highlight from "@tiptap/extension-highlight";
// import Image from "@tiptap/extension-image";
// import { ReactNodeViewRenderer } from "@tiptap/react";
// import { mergeAttributes, Range } from "@tiptap/core";
// import ImageBlockView from "@/tipTap/extensions/ImageBlock/components/ImageBlockView";

// const ImageBlock = Image.extend({
//   name: "imageBlock",

//   group: "block",

//   defining: true,

//   isolating: true,

//   addAttributes() {
//     return {
//       src: {
//         default: "",
//         parseHTML: (element) => element.getAttribute("src"),
//         renderHTML: (attributes) => ({
//           src: attributes.src,
//         }),
//       },
//       width: {
//         default: "100%",
//         parseHTML: (element) => element.getAttribute("data-width"),
//         renderHTML: (attributes) => ({
//           "data-width": attributes.width,
//         }),
//       },
//       align: {
//         default: "center",
//         parseHTML: (element) => element.getAttribute("data-align"),
//         renderHTML: (attributes) => ({
//           "data-align": attributes.align,
//         }),
//       },
//       alt: {
//         default: undefined,
//         parseHTML: (element) => element.getAttribute("alt"),
//         renderHTML: (attributes) => ({
//           alt: attributes.alt,
//         }),
//       },
//     };
//   },

//   parseHTML() {
//     return [
//       {
//         tag: 'img[src*="tiptap.dev"]:not([src^="data:"]), img[src*="windows.net"]:not([src^="data:"])',
//       },
//     ];
//   },

//   renderHTML({ HTMLAttributes }) {
//     return [
//       "img",
//       mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
//     ];
//   },

//   addCommands() {
//     return {
//       setImageBlock:
//         (attrs) =>
//         ({ commands }) => {
//           return commands.insertContent({
//             type: "imageBlock",
//             attrs: { src: attrs.src },
//           });
//         },

//       setImageBlockAt:
//         (attrs) =>
//         ({ commands }) => {
//           return commands.insertContentAt(attrs.pos, {
//             type: "imageBlock",
//             attrs: { src: attrs.src },
//           });
//         },

//       setImageBlockAlign:
//         (align) =>
//         ({ commands }) =>
//           commands.updateAttributes("imageBlock", { align }),

//       setImageBlockWidth:
//         (width) =>
//         ({ commands }) =>
//           commands.updateAttributes("imageBlock", {
//             width: `${Math.max(0, Math.min(100, width))}%`,
//           }),
//     };
//   },

//   addNodeView() {
//     return ReactNodeViewRenderer(ImageBlockView);
//   },
// });

// const PreviewBlog = () => {
//   const html = generateHTML(initialContent, [
//     StarterKit,
//     Emoji,
//     Link,
//     TextStyle,
//     Highlight,
//     ImageBlock,
//   ]);

//   return (
//     <div
//       dangerouslySetInnerHTML={{ __html: html }}
//       className="ProseMirror"
//     ></div>
//   );
// };

// export default PreviewBlog;

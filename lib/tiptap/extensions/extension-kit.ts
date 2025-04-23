import { gitHubEmojis } from "@tiptap-pro/extension-emoji";
import TextDirection from "tiptap-text-direction";
import {
  BlockquoteFigure,
  CharacterCount,
  Color,
  Column,
  Columns,
  Document,
  Dropcursor,
  Emoji,
  emojiSuggestion,
  Figcaption,
  FileHandler,
  Focus,
  FontSize,
  Heading,
  Highlight,
  HorizontalRule,
  ImageBlock,
  Link,
  OnPaste,
  Placeholder,
  Selection,
  SlashCommand,
  StarterKit,
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableOfContents,
  TableRow,
  TaskItem,
  TaskList,
  TextAlign,
  TextStyle,
  TrailingNode,
  Typography,
  Underline,
} from ".";

import { uploadImage, UploadingFolder } from "@/lib/cloudinary/cloudinary.utils";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import History from "@tiptap/extension-history";
import { lowlight } from "lowlight";
import { ImageUpload } from "./ImageUpload";
import { TableOfContentsNode } from "./TableOfContentsNode";

export const ExtensionKit = () => [
  Document,
  Columns,
  TaskList,
  TaskItem.configure({
    nested: true,
  }),
  Column,
  Selection,
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6],
  }),
  HorizontalRule,
  StarterKit.configure({
    document: false,
    dropcursor: false,
    heading: false,
    horizontalRule: false,
    blockquote: false,
    history: false,
    codeBlock: false,
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: null,
  }),
  TextStyle,
  FontSize,
  Color,
  TrailingNode,
  Link.configure({
    openOnClick: false,
  }),
  Highlight.configure({ multicolor: true }),
  Underline,
  CharacterCount.configure({ limit: 50000 }),
  TableOfContents,
  TableOfContentsNode,
  ImageUpload.configure(),
  ImageBlock,
  FileHandler.configure({
    allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
    onDrop: (currentEditor, files, pos) => {
      files.forEach(async (file) => {
        const url = await uploadImage(file, UploadingFolder.courses);
        if (typeof url === "string")
          currentEditor.chain().setImageBlockAt({ pos, src: url }).focus().run();
      });
    },
    onPaste: (currentEditor, files, pasteContent) => {
      files.forEach(async (file) => {
        const url = await uploadImage(file, UploadingFolder.courses);
        if (typeof url === "string")
          return currentEditor
            .chain()
            .setImageBlockAt({
              pos: currentEditor.state.selection.anchor,
              src: url,
            })
            .focus()
            .run();
      });
      return currentEditor.chain().removeEmptyTextStyle();
    },
  }),
  Emoji.configure({
    emojis: gitHubEmojis,
    enableEmoticons: true,
    suggestion: emojiSuggestion,
  }),
  TextAlign.extend({
    addKeyboardShortcuts() {
      return {};
    },
  }).configure({
    types: ["heading", "paragraph"],
  }),
  Subscript,
  Superscript,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Typography,
  Placeholder.configure({
    includeChildren: true,
    showOnlyCurrent: false,

    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return "What’s the title?";
      }
      return "";
    },
  }),
  SlashCommand,
  Focus,
  Figcaption,
  BlockquoteFigure,
  Dropcursor.configure({
    width: 2,
    class: "ProseMirror-dropcursor border-border",
  }),
  History,
  OnPaste,
  TextDirection.configure({
    types: ["heading", "paragraph", "blockquote"],
  }),
];

export default ExtensionKit;

"use client";
import { type Editor } from "@tiptap/react";
import {
  Bold,
  Strikethrough,
  Italic,
  List,
  ListOrdered,
  TextQuote,
  Heading4,
  Minus,
  Link2,
  Link2Off,
  Pilcrow,
} from "lucide-react";

import { Toggle } from "./toggle";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";
import { useCallback } from "react";

type Props = { editor: Editor | null };

const EditorToolbar = ({ editor }: Props) => {
  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    // cancelled
    if (url === null) {
      return;
    }

    // empty
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();

      return;
    }

    // update link
    editor
      ?.chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-input bg-transparent ">
      <Toggle
        size="sm"
        pressed={editor.isActive("paragraph")}
        onPressedChange={() => editor.chain().focus().setParagraph().run()}
      >
        <ToolbarIcon icon={<Pilcrow className="h-4 w-4" />} name="Paragraph" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("heading")}
        onPressedChange={() =>
          editor.chain().focus().toggleHeading({ level: 4 }).run()
        }
      >
        <ToolbarIcon icon={<Heading4 className="h-4 w-4" />} name="Heading-4" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
      >
        <ToolbarIcon icon={<Bold className="h-4 w-4" />} name="Bold" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
      >
        <ToolbarIcon icon={<Italic className="h-4 w-4" />} name="Italic" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
      >
        <ToolbarIcon
          icon={<Strikethrough className="h-4 w-4" />}
          name="Strikethrough"
        />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("bulletList")}
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ToolbarIcon icon={<List className="h-4 w-4" />} name="Bullet List" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("orderedList")}
        onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ToolbarIcon
          icon={<ListOrdered className="h-4 w-4" />}
          name="Ordered List"
        />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("blockquote")}
        onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <ToolbarIcon
          icon={<TextQuote className="h-4 w-4" />}
          name="Blockquote"
        />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("horizontalRule")}
        onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <ToolbarIcon
          icon={<Minus className="h-4 w-4" />}
          name="horizontal Line"
        />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("link")}
        onPressedChange={setLink}
      >
        <ToolbarIcon icon={<Link2 className="h-4 w-4" />} name="Link" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={!editor.isActive("link")}
        onPressedChange={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive("link")}
      >
        <ToolbarIcon icon={<Link2Off className="h-4 w-4" />} name="Link" />
      </Toggle>
    </div>
  );
};

const ToolbarIcon = ({
  icon,
  name,
}: {
  icon: React.ReactNode;
  name: string;
}) => {
  return (
    <HoverCard openDelay={0}>
      <HoverCardTrigger>{icon}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        className=" w-fit p-2 text-xs text-muted-foreground"
      >
        {name}
      </HoverCardContent>
    </HoverCard>
  );
};

export default EditorToolbar;

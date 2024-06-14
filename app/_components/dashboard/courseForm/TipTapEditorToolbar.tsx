"use client";

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
  Youtube,
  Undo,
  Redo,
  AlignJustify,
  AlignCenter,
  AlignLeft,
  AlignRight,
  RemoveFormatting,
} from "lucide-react";

import { Toggle } from "../../../../components/ui/toggle";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../../components/ui/hover-card";
import { memo, useCallback } from "react";

const EditorToolbar = memo(function ({ editor }: { editor: any }) {
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
    <div className="flex flex-wrap justify-center rounded-md border border-input bg-transparent">
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
        className="hidden md:block"
        onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
      >
        <ToolbarIcon icon={<List className="h-4 w-4" />} name="Bullet List" />
      </Toggle>

      <Toggle
        size="sm"
        className="hidden md:block"
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

      <Toggle
        size="sm"
        className="hidden md:block"
        pressed={editor.isActive({ textAlign: "left" })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign("left").run();
        }}
      >
        <ToolbarIcon icon={<AlignLeft className="h-4 w-4" />} name="Left" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "center" })}
        className={`${editor.isActive({ textAlign: "center" }) ? "is-active" : ""} hidden md:block`}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign("center").run();
        }}
      >
        <ToolbarIcon icon={<AlignCenter className="h-4 w-4" />} name="Center" />
      </Toggle>

      <Toggle
        size="sm"
        className="hidden md:block"
        pressed={editor.isActive({ textAlign: "right" })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign("right").run();
        }}
      >
        <ToolbarIcon icon={<AlignRight className="h-4 w-4" />} name="Right" />
      </Toggle>

      <Toggle
        size="sm"
        className="hidden md:block"
        pressed={editor.isActive({ textAlign: "justify" })}
        onPressedChange={() => {
          editor.chain().focus().setTextAlign("justify").run();
        }}
      >
        <ToolbarIcon
          icon={<AlignJustify className="h-4 w-4" />}
          name="Justify"
        />
      </Toggle>

      <Toggle
        size="sm"
        className="hidden md:block"
        pressed={editor.isActive("undo")}
        onPressedChange={() => editor.chain().focus().undo().run()}
      >
        <ToolbarIcon icon={<Undo className="h-4 w-4" />} name="Undo" />
      </Toggle>

      <Toggle
        size="sm"
        className="hidden md:block"
        pressed={editor.isActive("redo")}
        onPressedChange={() => editor.chain().focus().redo().run()}
      >
        <ToolbarIcon icon={<Redo className="h-4 w-4" />} name="Redo" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive("clearFormatting")}
        onPressedChange={() =>
          editor.chain().focus().clearNodes().unsetAllMarks().run()
        }
      >
        <ToolbarIcon
          icon={<RemoveFormatting className="h-4 w-4" />}
          name="Clear formatting"
        />
      </Toggle>
    </div>
  );
});

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
        className="w-fit p-2 text-xs text-muted-foreground"
      >
        {name}
      </HoverCardContent>
    </HoverCard>
  );
};

export default EditorToolbar;

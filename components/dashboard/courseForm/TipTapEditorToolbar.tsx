"use client";

import {
  Bold as BoldIcon,
  Strikethrough as Strikethrough,
  Italic as ItalicIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  TextQuote as TextQuoteIcon,
  Heading4 as Heading4Icon,
  Minus as MinusIcon,
  Link2 as Link2Icon,
  Link2Off as Link2OffIcon,
  Pilcrow as PilcrowIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  AlignJustify as AlignJustifyIcon,
  AlignCenter as AlignCenterIcon,
  AlignLeft as AlignLeftIcon,
  AlignRight as AlignRightIcon,
  RemoveFormatting as RemoveFormattingIcon,
} from "lucide-react";

import { Toggle } from "../../ui/toggle";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../ui/hover-card";
import { memo, useCallback } from "react";

export default function EditorToolbar({ editor }: { editor: any }) {
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
      <Paragraph editor={editor} />
      <Heading editor={editor} />
      <Bold editor={editor} />
      <Italic editor={editor} />
      <StrikeThrough editor={editor} />
      <BulletList editor={editor} />
      <OrderedList editor={editor} />
      <BlockQuote editor={editor} />
      <HorizontalLine editor={editor} />
      <SetLink editor={editor} />
      <UnsetLink editor={editor} />
      <Left editor={editor} />
      <Center editor={editor} />
      <Right editor={editor} />
      <Justify editor={editor} />
      <Undo editor={editor} />
      <Redo editor={editor} />
      <ClearFormatting editor={editor} />
    </div>
  );
}

const ToolbarIcon = ({
  icon,
  name,
}: {
  icon: React.ReactNode;
  name: string;
}) => {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
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

function StrikeThrough({ editor }) {
  return (
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
  );
}

function BulletList({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("bulletList")}
      className="hidden md:block"
      onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
    >
      <ToolbarIcon icon={<ListIcon className="h-4 w-4" />} name="Bullet List" />
    </Toggle>
  );
}

function OrderedList({ editor }) {
  return (
    <Toggle
      size="sm"
      className="hidden md:block"
      pressed={editor.isActive("orderedList")}
      onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
    >
      <ToolbarIcon
        icon={<ListOrderedIcon className="h-4 w-4" />}
        name="Ordered List"
      />
    </Toggle>
  );
}

function BlockQuote({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("blockquote")}
      onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
    >
      <ToolbarIcon
        icon={<TextQuoteIcon className="h-4 w-4" />}
        name="Blockquote"
      />
    </Toggle>
  );
}

function HorizontalLine({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("horizontalRule")}
      onPressedChange={() => editor.chain().focus().setHorizontalRule().run()}
    >
      <ToolbarIcon
        icon={<MinusIcon className="h-4 w-4" />}
        name="horizontal Line"
      />
    </Toggle>
  );
}

function SetLink({ editor }, setLink: () => void) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("link")}
      onPressedChange={setLink}
    >
      <ToolbarIcon icon={<Link2Icon className="h-4 w-4" />} name="Link" />
    </Toggle>
  );
}

function UnsetLink({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={!editor.isActive("link")}
      onPressedChange={() => editor.chain().focus().unsetLink().run()}
      disabled={!editor.isActive("link")}
    >
      <ToolbarIcon icon={<Link2OffIcon className="h-4 w-4" />} name="Link" />
    </Toggle>
  );
}

function Left({ editor }) {
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "left" }) ? "data-[state=on]" : ""} hidden md:block`}
      pressed={editor.isActive({ textAlign: "left" })}
      onPressedChange={() => {
        editor.chain().focus().setTextAlign("left").run();
      }}
    >
      <ToolbarIcon icon={<AlignLeftIcon className="h-4 w-4" />} name="Left" />
    </Toggle>
  );
}

function Center({ editor }) {
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "center" }) ? "data-[state=on]" : ""} hidden md:block`}
      pressed={editor.isActive({ textAlign: "center" })}
      onPressedChange={() => {
        editor.chain().focus().setTextAlign("center").run();
      }}
    >
      <ToolbarIcon
        icon={<AlignCenterIcon className="h-4 w-4" />}
        name="Center"
      />
    </Toggle>
  );
}

function Right({ editor }) {
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "right" }) ? "data-[state=on]" : ""}} hidden md:block`}
      pressed={editor.isActive({ textAlign: "right" })}
      onPressedChange={() => {
        editor.chain().focus().setTextAlign("right").run();
      }}
    >
      <ToolbarIcon icon={<AlignRightIcon className="h-4 w-4" />} name="Right" />
    </Toggle>
  );
}

function Justify({ editor }) {
  return (
    <Toggle
      size="sm"
      className="hidden md:block"
      pressed={editor.isActive({ textAlign: "justify" })}
      onPressedChange={() => {
        editor.chain().focus().setTextAlign("justify").run();
      }}
    >
      <ToolbarIcon
        icon={<AlignJustifyIcon className="h-4 w-4" />}
        name="Justify"
      />
    </Toggle>
  );
}

function Undo({ editor }) {
  return (
    <Toggle
      size="sm"
      className="hidden md:block"
      pressed={editor.isActive("undo")}
      onPressedChange={() => editor.chain().focus().undo().run()}
    >
      <ToolbarIcon icon={<UndoIcon className="h-4 w-4" />} name="Undo" />
    </Toggle>
  );
}

function Redo({ editor }) {
  return (
    <Toggle
      size="sm"
      className="hidden md:block"
      pressed={editor.isActive("redo")}
      onPressedChange={() => editor.chain().focus().redo().run()}
    >
      <ToolbarIcon icon={<RedoIcon className="h-4 w-4" />} name="Redo" />
    </Toggle>
  );
}

function ClearFormatting({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("clearFormatting")}
      onPressedChange={() =>
        editor.chain().focus().clearNodes().unsetAllMarks().run()
      }
    >
      <ToolbarIcon
        icon={<RemoveFormattingIcon className="h-4 w-4" />}
        name="Clear formatting"
      />
    </Toggle>
  );
}

export function Italic({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("italic")}
      onPressedChange={() => editor.chain().focus().toggleItalic().run()}
    >
      <ToolbarIcon icon={<ItalicIcon className="h-4 w-4" />} name="Italic" />
    </Toggle>
  );
}

export function Bold({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("bold")}
      onPressedChange={() => editor.chain().focus().toggleBold().run()}
    >
      <ToolbarIcon icon={<BoldIcon className="h-4 w-4" />} name="Bold" />
    </Toggle>
  );
}

export function Heading({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("heading")}
      onPressedChange={() =>
        editor.chain().focus().toggleHeading({ level: 4 }).run()
      }
    >
      <ToolbarIcon
        icon={<Heading4Icon className="h-4 w-4" />}
        name="Heading-4"
      />
    </Toggle>
  );
}

export function Paragraph({ editor }) {
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("paragraph")}
      onPressedChange={() => editor.chain().focus().setParagraph().run()}
    >
      <ToolbarIcon
        icon={<PilcrowIcon className="h-4 w-4" />}
        name="Paragraph"
      />
    </Toggle>
  );
}

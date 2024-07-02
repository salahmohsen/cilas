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
import { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EditorToolbar({ editor }: { editor: any }) {
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
  const handleStrike = useCallback(
    () => editor.chain().focus().toggleStrike().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("strike")}
      onPressedChange={handleStrike}
    >
      <ToolbarIcon
        icon={<Strikethrough className="h-4 w-4" />}
        name="Strikethrough"
      />
    </Toggle>
  );
}

function BulletList({ editor }) {
  const handleBulletList = useCallback(
    () => editor.chain().focus().toggleBulletList().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("bulletList")}
      className="hidden md:flex"
      onPressedChange={handleBulletList}
    >
      <ToolbarIcon icon={<ListIcon className="h-4 w-4" />} name="Bullet List" />
    </Toggle>
  );
}

function OrderedList({ editor }) {
  const handleOrederedList = useCallback(
    () => editor.chain().focus().toggleOrderedList().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className="hidden md:flex"
      pressed={editor.isActive("orderedList")}
      onPressedChange={handleOrederedList}
    >
      <ToolbarIcon
        icon={<ListOrderedIcon className="h-4 w-4" />}
        name="Ordered List"
      />
    </Toggle>
  );
}

function BlockQuote({ editor }) {
  const handleBlockQuote = useCallback(
    () => editor.chain().focus().toggleBlockquote().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("blockquote")}
      onPressedChange={handleBlockQuote}
    >
      <ToolbarIcon
        icon={<TextQuoteIcon className="h-4 w-4" />}
        name="Blockquote"
      />
    </Toggle>
  );
}

function HorizontalLine({ editor }) {
  const handleHorizontalLine = useCallback(
    () => editor.chain().focus().setHorizontalRule().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("horizontalRule")}
      onPressedChange={handleHorizontalLine}
    >
      <ToolbarIcon
        icon={<MinusIcon className="h-4 w-4" />}
        name="horizontal Line"
      />
    </Toggle>
  );
}

export function SetLink({ editor }) {
  const previousUrl = editor?.getAttributes("link").href;
  const [url, setUrl] = useState<string>("");

  const handleSetLink = useCallback(
    (url: string) => {
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
    },
    [editor],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Toggle size="sm" pressed={editor.isActive("link")}>
          <ToolbarIcon icon={<Link2Icon className="h-4 w-4" />} name="Link" />
        </Toggle>
      </DialogTrigger>
      <DialogContent className="p-2">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter a link"
            defaultValue={previousUrl}
            onChange={(e) => setUrl(e.target.value)}
          />
          <DialogClose asChild>
            <Button
              className="bg-foreground hover:bg-foreground"
              onClick={() => handleSetLink(url)}
            >
              <Link2Icon size={16} />
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnsetLink({ editor }) {
  const handleUnsetLink = useCallback(
    () => editor.chain().focus().unsetLink().run(),
    [editor],
  );

  return (
    <Toggle
      size="sm"
      pressed={!editor.isActive("link")}
      onPressedChange={handleUnsetLink}
      disabled={!editor.isActive("link")}
    >
      <ToolbarIcon icon={<Link2OffIcon className="h-4 w-4" />} name="Link" />
    </Toggle>
  );
}

function Left({ editor }) {
  const handleLeft = useCallback(
    () => editor.chain().focus().setTextAlign("left").run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "left" }) ? "data-[state=on]" : ""} hidden md:flex`}
      pressed={editor.isActive({ textAlign: "left" })}
      onPressedChange={handleLeft}
    >
      <ToolbarIcon icon={<AlignLeftIcon className="h-4 w-4" />} name="Left" />
    </Toggle>
  );
}

function Center({ editor }) {
  const handleCenter = useCallback(
    () => editor.chain().focus().setTextAlign("center").run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "center" }) ? "data-[state=on]" : ""} hidden md:flex`}
      pressed={editor.isActive({ textAlign: "center" })}
      onPressedChange={handleCenter}
    >
      <ToolbarIcon
        icon={<AlignCenterIcon className="h-4 w-4" />}
        name="Center"
      />
    </Toggle>
  );
}

function Right({ editor }) {
  const handleRight = useCallback(
    () => editor.chain().focus().setTextAlign("right").run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className={`${editor.isActive({ textAlign: "right" }) ? "data-[state=on]" : ""}} hidden md:flex`}
      pressed={editor.isActive({ textAlign: "right" })}
      onPressedChange={handleRight}
    >
      <ToolbarIcon icon={<AlignRightIcon className="h-4 w-4" />} name="Right" />
    </Toggle>
  );
}

function Justify({ editor }) {
  const handleJustify = useCallback(
    () => editor.chain().focus().setTextAlign("justify").run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className="hidden md:flex"
      pressed={editor.isActive({ textAlign: "justify" })}
      onPressedChange={handleJustify}
    >
      <ToolbarIcon
        icon={<AlignJustifyIcon className="h-4 w-4" />}
        name="Justify"
      />
    </Toggle>
  );
}

function Undo({ editor }) {
  const handleUndo = useCallback(
    () => editor.chain().focus().undo().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className="hidden md:flex"
      pressed={editor.isActive("undo")}
      onPressedChange={handleUndo}
    >
      <ToolbarIcon icon={<UndoIcon className="h-4 w-4" />} name="Undo" />
    </Toggle>
  );
}

function Redo({ editor }) {
  const handleRedo = useCallback(
    () => editor.chain().focus().redo().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className="hidden md:flex"
      pressed={editor.isActive("redo")}
      onPressedChange={handleRedo}
    >
      <ToolbarIcon icon={<RedoIcon className="h-4 w-4" />} name="Redo" />
    </Toggle>
  );
}

function ClearFormatting({ editor }) {
  const handleClearFormatting = useCallback(
    () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("clearFormatting")}
      onPressedChange={handleClearFormatting}
    >
      <ToolbarIcon
        icon={<RemoveFormattingIcon className="h-4 w-4" />}
        name="Clear formatting"
      />
    </Toggle>
  );
}

export function Italic({ editor }) {
  const handleItalic = useCallback(
    () => editor.chain().focus().toggleItalic().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("italic")}
      onPressedChange={handleItalic}
    >
      <ToolbarIcon icon={<ItalicIcon className="h-4 w-4" />} name="Italic" />
    </Toggle>
  );
}

export function Bold({ editor }) {
  const handleBold = useCallback(
    () => editor.chain().focus().toggleBold().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("bold")}
      onPressedChange={handleBold}
    >
      <ToolbarIcon icon={<BoldIcon className="h-4 w-4" />} name="Bold" />
    </Toggle>
  );
}

export function Heading({ editor }) {
  const handleHeading = useCallback(
    () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("heading")}
      onPressedChange={handleHeading}
    >
      <ToolbarIcon
        icon={<Heading4Icon className="h-4 w-4" />}
        name="Heading-4"
      />
    </Toggle>
  );
}

export function Paragraph({ editor }) {
  const handleParagraph = useCallback(
    () => editor.chain().focus().setParagraph().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      pressed={editor.isActive("paragraph")}
      onPressedChange={handleParagraph}
    >
      <ToolbarIcon
        icon={<PilcrowIcon className="h-4 w-4" />}
        name="Paragraph"
      />
    </Toggle>
  );
}

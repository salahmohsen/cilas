"use client";

import {
  AlignCenter as AlignCenterIcon,
  AlignJustify as AlignJustifyIcon,
  AlignLeft as AlignLeftIcon,
  AlignRight as AlignRightIcon,
  Bold as BoldIcon,
  Heading4 as Heading4Icon,
  Italic as ItalicIcon,
  Link2 as Link2Icon,
  Link2Off as Link2OffIcon,
  List as ListIcon,
  ListOrdered as ListOrderedIcon,
  Minus as MinusIcon,
  Pilcrow as PilcrowIcon,
  Redo as RedoIcon,
  RemoveFormatting as RemoveFormattingIcon,
  Strikethrough,
  TextQuote as TextQuoteIcon,
  Undo as UndoIcon,
} from "lucide-react";

import { Button } from "@/components/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { useCallback, useState } from "react";

export function EditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;

  return (
    <div className="border-input flex flex-wrap justify-center rounded-md border bg-transparent">
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

const ToolbarIcon = ({ icon, name }: { icon: React.ReactNode; name: string }) => {
  return (
    <HoverCard openDelay={0} closeDelay={0}>
      <HoverCardTrigger>{icon}</HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="center"
        className="text-muted-foreground w-fit p-2 text-xs"
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
      className="hidden md:flex"
    >
      <ToolbarIcon icon={<Strikethrough className="h-4 w-4" />} name="Strikethrough" />
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
  const handleOrderedList = useCallback(
    () => editor.chain().focus().toggleOrderedList().run(),
    [editor],
  );
  return (
    <Toggle
      size="sm"
      className="hidden md:flex"
      pressed={editor.isActive("orderedList")}
      onPressedChange={handleOrderedList}
    >
      <ToolbarIcon icon={<ListOrderedIcon className="h-4 w-4" />} name="Ordered List" />
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
      <ToolbarIcon icon={<TextQuoteIcon className="h-4 w-4" />} name="Blockquote" />
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
      <ToolbarIcon icon={<MinusIcon className="h-4 w-4" />} name="horizontal Line" />
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
      editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    [editor],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Toggle size="sm" pressed={editor.isActive("link")}>
          <ToolbarIcon icon={<Link2Icon className="h-4 w-4" />} name="Link" />
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="p-1">
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="Enter a link"
            defaultValue={previousUrl}
            onChange={(e) => setUrl(e.target.value)}
          />
          <Button onClick={() => handleSetLink(url)}>
            <Link2Icon size={16} />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
      <ToolbarIcon icon={<AlignCenterIcon className="h-4 w-4" />} name="Center" />
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
      <ToolbarIcon icon={<AlignJustifyIcon className="h-4 w-4" />} name="Justify" />
    </Toggle>
  );
}

function Undo({ editor }) {
  const handleUndo = useCallback(() => editor.chain().focus().undo().run(), [editor]);
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
  const handleRedo = useCallback(() => editor.chain().focus().redo().run(), [editor]);
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
    <Toggle size="sm" pressed={editor.isActive("italic")} onPressedChange={handleItalic}>
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
    <Toggle size="sm" pressed={editor.isActive("bold")} onPressedChange={handleBold}>
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
      <ToolbarIcon icon={<Heading4Icon className="h-4 w-4" />} name="Heading-4" />
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
      <ToolbarIcon icon={<PilcrowIcon className="h-4 w-4" />} name="Paragraph" />
    </Toggle>
  );
}

import { useFormContext } from "react-hook-form";

import { useEditor, EditorContent } from "@tiptap/react";
import {
  editorProps,
  starterKit,
  placeholderExtension,
  typography,
  link,
  textAlign,
  textDirection,
} from "./TipTapExtensions";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../ui/form";

import EditorToolbar from "@/components/dashboard/courseForm/TipTapEditorToolbar";

import { cn } from "@/lib/utils";

import { StandardProps } from "./types";
import React, { memo } from "react";

export const TipTapInput = memo(function TipTapInput({
  name,
  label,
  placeholder,
  className,
}: StandardProps): React.ReactElement {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <>
              <input
                hidden
                name={name}
                value={JSON.stringify(field.value)}
                onChange={field.onChange}
              />
              <Editor
                className={className}
                editorRef={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
              />
            </>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

type EditorProps = {
  className: string | undefined;
  editorRef: any;
  value: any;
  onChange: (value: string) => void;
  onBlur: any;
  disabled: boolean | undefined;
};

const Editor: React.FC<EditorProps> = ({
  className,
  editorRef,
  value,
  onChange,
  onBlur,
  disabled,
}) => {
  // ## To Do ## run Clean on the server instead of the client
  // const clean = (dirty: string) => {
  //   const options = {
  //     allowedTags: [
  //       "p",
  //       "h4",
  //       "hr",
  //       "li",
  //       "ol",
  //       "ul",
  //       "em",
  //       "i",
  //       "strong",
  //       "blockquote",
  //       "s",
  //       "a",
  //       "br",
  //       "iframe",
  //     ],
  //     // Transform 'a' tags to add target and rel attributes
  //     transformTags: {
  //       a: sanitizeHtml.simpleTransform("a", {
  //         target: "_blank",
  //         rel: "noopener noreferrer",
  //       }),
  //     },
  //     // Define allowed attributes
  //     allowedAttributes: {
  //       a: ["href", "target", "rel"],
  //       p: ["dir"],
  //       h4: ["dir"],
  //       iframe: [
  //         "src",
  //         "width",
  //         "height",
  //         "allowfullscreen",
  //         "autoplay",
  //         "cclanguage",
  //         "disablekbcontrols",
  //         "enableiframeapi",
  //         "endtime",
  //         "ivloadpolicy",
  //         "loop",
  //         "modestbranding",
  //         "start",
  //       ],
  //     },
  //     // Define allowed iframe hostnames
  //     allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
  //   };

  //   return sanitizeHtml(dirty, options);
  // };
  const editor = useEditor({
    extensions: [
      starterKit,
      placeholderExtension,
      typography,
      link,
      textAlign,
      textDirection,
    ],
    editorProps: {
      attributes: {
        class:
          "overflow-y-auto scrollbar-thin min-h-[150px] rounded-md border border-input bg-background px-3 py-3 ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      },
    },
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className={cn("flex w-full flex-col gap-1", className)}>
      <EditorToolbar editor={editor} />
      <EditorContent
        editor={editor}
        ref={editorRef}
        onBlur={onBlur}
        disabled={disabled}
        className="max-w-6xl"
      />
    </div>
  );
};

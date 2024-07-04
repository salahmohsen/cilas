import { useFormContext } from "react-hook-form";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import {
  starterKit,
  placeholderExtension,
  typography,
  link,
  textAlign,
  textDirection,
} from "@/lib/tiptap-extensions";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { cn } from "@/lib/utils";

import { StandardProps } from "@/types/formInputs.types";
import React, { memo } from "react";
import {
  Bold,
  Italic,
  SetLink,
  UnsetLink,
  EditorToolbar,
} from "./form.input.tipTap.toolBar";

interface TipTapInputProps extends StandardProps {
  editorToolbar?: boolean;
}

export const TipTapInput = memo(function TipTapInput({
  name,
  label,
  placeholder,
  className,
  editorToolbar = true,
}: TipTapInputProps) {
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
                value={field.value}
                onChange={field.onChange}
              />
              <Editor
                editorRef={field.ref}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                disabled={field.disabled}
                placeholder={placeholder}
                editorToolbar={editorToolbar}
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
  className?: string;
  editorRef: any;
  value: any;
  onChange: (value: string) => void;
  onBlur: any;
  disabled?: boolean;
  placeholder: string;
  editorToolbar: boolean;
};

const Editor: React.FC<EditorProps> = ({
  className,
  editorRef,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  editorToolbar,
}) => {
  const editor = useEditor({
    extensions: [
      starterKit,
      placeholderExtension(placeholder),
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
      {editorToolbar && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        ref={editorRef}
        onBlur={onBlur}
        disabled={disabled}
        className="max-w-full break-all"
      />
      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          className="scale-80 rounded-lg border bg-background opacity-90"
        >
          <Bold editor={editor} />
          <Italic editor={editor} />
          <SetLink editor={editor} />
          <UnsetLink editor={editor} />
        </BubbleMenu>
      )}
    </div>
  );
};

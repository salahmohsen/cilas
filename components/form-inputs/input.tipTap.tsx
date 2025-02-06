import { FieldPath, FieldValues } from "react-hook-form";

import {
  link,
  placeholderExtension,
  starterKit,
  textAlign,
  textDirection,
  typography,
} from "@/lib/tiptap/tiptap-extensions";
import { BubbleMenu, EditorContent, useEditor } from "@tiptap/react";

import { cn } from "@/lib/utils/utils";

import { TipTapInputProps } from "@/lib/types/form.inputs.types";
import React, { memo } from "react";
import { FormFieldProvider } from "./form.input.wrapper";
import { Bold, EditorToolbar, Italic, SetLink, UnsetLink } from "./input.tipTap.toolBar";

const TipTapInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
  editorToolbar = true,
}: TipTapInputProps<TData, TName>) => {
  return (
    <FormFieldProvider<TData, TName> name={name} label={label} itemClasses={className}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            <input hidden name={name} value={value} onChange={setValue} />
            <Editor
              editorRef={field.ref}
              value={value}
              onChange={setValue}
              onBlur={field.onBlur}
              disabled={field.disabled}
              placeholder={placeholder ?? ""}
              editorToolbar={editorToolbar}
            />
          </>
        );
      }}
    </FormFieldProvider>
  );
};

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
          updateDelay={0}
          className="scale-80 hidden rounded-lg border bg-opacity-0 backdrop-blur-md md:block"
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

export default memo(TipTapInput) as typeof TipTapInput;

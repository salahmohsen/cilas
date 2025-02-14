import { JSONContent } from "@tiptap/core";
import React, { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";

type ContentInputProps = {
  contentName: "enContent" | "arContent";
  titleName: "enTitle" | "arTitle";
  content?: JSONContent | undefined;
};

export const ContentInput: React.FC<ContentInputProps> = ({
  contentName,
  titleName,
  content: fullContent,
}) => {
  const { setValue } = useFormContext();
  const [title, setTitle] = useState<string>("");
  const [content, setContent] = useState<string>("");

  const extractTitle = useCallback(() => {
    const headingNodeText = fullContent?.content?.[0]?.content?.[0]?.text;
    if (headingNodeText) {
      setValue(titleName, headingNodeText, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setTitle(headingNodeText || "");
    }
  }, [fullContent?.content, setValue, titleName]);

  const extractContent = useCallback(() => {
    setValue(contentName, JSON.stringify(fullContent || ""), {
      shouldValidate: true,
      shouldDirty: true,
    });
    setContent(JSON.stringify(fullContent || ""));
  }, [contentName, fullContent, setValue]);

  useEffect(() => {
    extractTitle();
    extractContent();
  }, [extractTitle, extractContent]);
  return (
    <>
      <input hidden name={titleName} value={title} readOnly />
      <input hidden name={contentName} value={JSON.stringify(content)} readOnly />
    </>
  );
};

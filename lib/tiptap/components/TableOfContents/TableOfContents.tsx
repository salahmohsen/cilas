"use client";

import { cn } from "@/lib/tiptap/lib/utils";
import { TableOfContentsStorage } from "@tiptap-pro/extension-table-of-contents";
import { Editor as CoreEditor } from "@tiptap/core";
import { memo, useCallback, useEffect, useState } from "react";

export type TableOfContentsProps = {
  editor: CoreEditor;
  onItemClick?: () => void;
};

export const TableOfContents = memo(({ editor, onItemClick }: TableOfContentsProps) => {
  const [data, setData] = useState<TableOfContentsStorage | null>(null);

  const updateData = useCallback(() => {
    if (editor && editor.extensionStorage && editor.extensionStorage.tableOfContents) {
      setData({ ...editor.extensionStorage.tableOfContents });
    }
  }, [editor]);

  useEffect(() => {
    const handler = ({ editor: currentEditor }: { editor: CoreEditor }) => {
      if (currentEditor && currentEditor.isEditable) {
        updateData();
      }
    };
    updateData();

    editor.on("create", handler);
    editor.on("update", handler);
    editor.on("selectionUpdate", handler);

    return () => {
      editor.off("create", handler);
      editor.off("update", handler);
      editor.off("selectionUpdate", handler);
    };
  }, [editor, updateData]);

  return (
    <div>
      {data && data.content.length > 0 ? (
        <div className="flex flex-col gap-1">
          {data.content.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              style={{ marginLeft: `${1 * item.level - 1}rem` }}
              onClick={onItemClick}
              className={cn(
                "bg-opacity-10 hover:bg-opacity-5 hover:bg-foreground hover:text-background block truncate rounded p-1 text-sm font-medium transition-all",
                item.isActive && "text-background bg-foreground",
              )}
            >
              {item.itemIndex}. {item.textContent}
            </a>
          ))}
        </div>
      ) : (
        <div className="text-sm text-neutral-500">
          Start adding headlines to your document …
        </div>
      )}
    </div>
  );
});

TableOfContents.displayName = "TableOfContents";

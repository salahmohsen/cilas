"use client";

import { Editor as CoreEditor } from "@tiptap/core";
import { memo, useCallback, useEffect, useState } from "react";
import { TableOfContentsStorage } from "@tiptap-pro/extension-table-of-contents";
import { cn } from "@/tipTap/lib/utils";

export type TableOfContentsProps = {
  editor: CoreEditor;
  onItemClick?: () => void;
};

export const TableOfContents = memo(
  ({ editor, onItemClick }: TableOfContentsProps) => {
    const [data, setData] = useState<TableOfContentsStorage | null>(null);

    const updateData = useCallback(() => {
      if (
        editor &&
        editor.extensionStorage &&
        editor.extensionStorage.tableOfContents
      ) {
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

      editor.on("update", handler);
      editor.on("selectionUpdate", handler);

      return () => {
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
                  "block w-full truncate rounded bg-opacity-10 p-1 text-sm font-medium text-neutral-500 transition-all hover:bg-black hover:bg-opacity-5 hover:text-neutral-800 dark:text-neutral-300",
                  item.isActive &&
                    "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100",
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
  },
);

TableOfContents.displayName = "TableOfContents";

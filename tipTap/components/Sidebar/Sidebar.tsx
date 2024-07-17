import { cn } from "@/tipTap/lib/utils";
import { memo, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { TableOfContents } from "../TableOfContents";

export const Sidebar = memo(
  ({
    editor,
    isOpen,
    onClose,
  }: {
    editor: Editor;
    isOpen?: boolean;
    onClose: () => void;
  }) => {
    const handlePotentialClose = useCallback(() => {
      if (window.innerWidth < 1024) {
        onClose();
      }
    }, [onClose]);

    const windowClassName = cn(
      "fixed top-[107px] left-0 sm:left-[58px]  backdrop-blur-sm h-full lg:h-screen w-0 invisible duration-300 transition-all z-[999999]",
      "bg-background/90",
      !isOpen && "border-r-transparent",
      isOpen && "w-80 border-r visible",
    );

    return (
      <div className={windowClassName}>
        <div className="h-full w-full overflow-hidden">
          <div className="h-full w-full overflow-auto p-6">
            <TableOfContents
              onItemClick={handlePotentialClose}
              editor={editor}
            />
          </div>
        </div>
      </div>
    );
  },
);

Sidebar.displayName = "TableOfContentSidepanel";

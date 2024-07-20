import { cn } from "@/tipTap/lib/utils";
import { memo, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { TableOfContents } from "../TableOfContents";

export const Sidebar = memo(
  ({
    children,
    editor,
    isOpen,
    onClose,
  }: {
    children: React.ReactNode;
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
      "fixed h-full right-0 lg:h-screen w-0 invisible transition-all duration-300 mt-16 ",
      "bg-background",
      !isOpen && "border-l-transparent",
      isOpen && "w-full sm:w-1/3 border-l visible",
    );

    return (
      <div className={windowClassName}>
        <div className="h-full overflow-auto p-6">
          <TableOfContents onItemClick={handlePotentialClose} editor={editor} />
          {children}
        </div>
      </div>
    );
  },
);

Sidebar.displayName = "TableOfContentSidepanel";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/tiptap/lib/utils";
import { EditorSidebar } from "@/lib/types/editor";
import { Editor } from "@tiptap/react";
import React, { memo, useCallback } from "react";
import { TableOfContents } from "../TableOfContents";

type SidebarProps = {
  children: React.ReactNode;
  editor: Editor;
  isOpen?: boolean;
  onClose: () => void;
  activeTab: EditorSidebar;
  activeTabOnChange: (value: EditorSidebar) => void;
};

export const Sidebar = memo(
  ({ children, editor, isOpen, onClose, activeTab, activeTabOnChange }: SidebarProps) => {
    const handlePotentialClose = useCallback(() => {
      if (window.innerWidth < 1024) {
        onClose();
      }
    }, [onClose]);

    const windowClassName = cn(
      "fixed right-0 top-32 h-[calc(100%-8rem)]  w-0 invisible transition-all duration-300 ",
      "bg-background",
      !isOpen && "border-l-transparent",
      isOpen && "w-full sm:w-[calc((100%-4rem)/1/3)] border-l visible",
    );

    return (
      <aside className={windowClassName}>
        <Tabs
          value={activeTab}
          onValueChange={activeTabOnChange as (value: string) => void}
          className="h-[calc(100%-8rem)]"
        >
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="tableOfContent">Contents</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="pr-2">
            <ScrollArea className="h-[calc(100vh-11rem)]">{children}</ScrollArea>
          </TabsContent>
          <TabsContent
            value="tableOfContent"
            className="m-6 h-full overflow-x-hidden overflow-y-auto"
          >
            <TableOfContents onItemClick={handlePotentialClose} editor={editor} />
          </TabsContent>
        </Tabs>
      </aside>
    );
  },
);

Sidebar.displayName = "TableOfContentSidepanel";

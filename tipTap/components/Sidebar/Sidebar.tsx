import { cn } from "@/tipTap/lib/utils";
import { memo, useCallback } from "react";
import { Editor } from "@tiptap/react";
import { TableOfContents } from "../TableOfContents";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      "fixed right-0 top-32 h-[calc(100vh-8rem)]  w-0 invisible transition-all duration-300   ",
      "bg-background",
      !isOpen && "border-l-transparent",
      isOpen && "w-full sm:w-1/3 border-l visible",
    );

    return (
      <aside className={windowClassName}>
        <Tabs defaultValue="form" className="h-[calc(100vh-8rem)]">
          <TabsList className="grid w-full grid-cols-2 rounded-none">
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="tableOfContent">Contents</TabsTrigger>
          </TabsList>

          <TabsContent value="form" className="pr-2">
            <ScrollArea className="h-[calc(100vh-11rem)]">
              <div className="space-y-8 p-6">{children}</div>
            </ScrollArea>
          </TabsContent>
          <TabsContent
            value="tableOfContent"
            className="h-full overflow-y-auto p-6"
          >
            <TableOfContents
              onItemClick={handlePotentialClose}
              editor={editor}
            />
          </TabsContent>
        </Tabs>
      </aside>
    );
  },
);

Sidebar.displayName = "TableOfContentSidepanel";

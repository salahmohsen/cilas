"use client";

import { Editor, EditorContent } from "@tiptap/react";
import React, { useRef } from "react";

import { LinkMenu } from "@/lib/tiptap/components/menus";

import { Sidebar } from "@/lib/tiptap/components/Sidebar";
import ImageBlockMenu from "@/lib/tiptap/extensions/ImageBlock/components/ImageBlockMenu";
import { ColumnsMenu } from "@/lib/tiptap/extensions/MultiColumn/menus";
import { TableColumnMenu, TableRowMenu } from "@/lib/tiptap/extensions/Table/menus";
import { SidebarState } from "@/lib/tiptap/hooks/useSidebar";
import { EditorSidebar } from "@/lib/types/editor";
import { ContentItemMenu } from "../menus/ContentItemMenu";
import { TextMenu } from "../menus/TextMenu";

type BlockEditorProps = {
  editor: Editor | null;
  leftSidebar: SidebarState;
  sidebarActiveTab: EditorSidebar;
  setSidebarActiveTab: (value: EditorSidebar) => void;
  children?: React.ReactNode;
};

export const BlockEditor = ({
  children,
  editor,
  leftSidebar,
  sidebarActiveTab,
  setSidebarActiveTab,
}: BlockEditorProps) => {
  const menuContainerRef = useRef(null);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex h-full overflow-hidden" ref={menuContainerRef}>
      <EditorContent editor={editor} className={`mt-16 w-full pl-16 lg:px-0`} />

      <Sidebar
        isOpen={leftSidebar.isOpen}
        onClose={leftSidebar.close}
        editor={editor}
        activeTab={sidebarActiveTab}
        activeTabOnChange={setSidebarActiveTab}
      >
        {children}
      </Sidebar>
      <ContentItemMenu editor={editor} />
      <LinkMenu editor={editor} appendTo={menuContainerRef} />
      <TextMenu editor={editor} />
      <ColumnsMenu editor={editor} appendTo={menuContainerRef} />
      <TableRowMenu editor={editor} appendTo={menuContainerRef} />
      <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
      <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
    </div>
  );
};

export default BlockEditor;

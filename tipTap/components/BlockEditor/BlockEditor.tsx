"use client";

import { Editor, EditorContent } from "@tiptap/react";
import React, { useMemo, useRef, useState } from "react";

import { LinkMenu } from "@/tipTap/components/menus";

import "@/tipTap/styles/index.css";

import { Sidebar } from "@/tipTap/components/Sidebar";
import ImageBlockMenu from "@/tipTap/extensions/ImageBlock/components/ImageBlockMenu";
import { ColumnsMenu } from "@/tipTap/extensions/MultiColumn/menus";
import { TableColumnMenu, TableRowMenu } from "@/tipTap/extensions/Table/menus";
import { TextMenu } from "../menus/TextMenu";
import { ContentItemMenu } from "../menus/ContentItemMenu";
import { SidebarState } from "@/tipTap/hooks/useSidebar";

type BlockEditorProps = {
  editor: Editor | null;
  leftSidebar: SidebarState;
  sidebarActiveTab: string;
  setSidebarActiveTab: (value: string) => void;
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

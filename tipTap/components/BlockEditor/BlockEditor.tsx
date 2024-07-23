"use client";

import { Editor, EditorContent } from "@tiptap/react";
import React, { useMemo, useRef } from "react";

import { LinkMenu } from "@/tipTap/components/menus";

import "@/tipTap/styles/index.css";

import { Sidebar } from "@/tipTap/components/Sidebar";
import { EditorContext } from "@/tipTap/context/EditorContext";
import ImageBlockMenu from "@/tipTap/extensions/ImageBlock/components/ImageBlockMenu";
import { ColumnsMenu } from "@/tipTap/extensions/MultiColumn/menus";
import { TableColumnMenu, TableRowMenu } from "@/tipTap/extensions/Table/menus";
import { TextMenu } from "../menus/TextMenu";
import { ContentItemMenu } from "../menus/ContentItemMenu";
import { SidebarState } from "@/tipTap/hooks/useSidebar";
import { EditorHeader } from "../EditorHeader";

type BlockEditorProps = {
  editor: Editor | null;
  leftSidebar: SidebarState;
  children?: React.ReactNode;
};

export const BlockEditor = ({
  children,
  editor,
  leftSidebar,
}: BlockEditorProps) => {
  const menuContainerRef = useRef(null);

  const providerValue = useMemo(() => {
    return {};
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <EditorContext.Provider value={providerValue}>
      <div
        className="-mx-5 -mt-5 flex h-full overflow-hidden sm:w-[calc(100%-4rem)]"
        ref={menuContainerRef}
      >
        <EditorContent
          editor={editor}
          className={`mt-16 w-full transition-all duration-300 ${leftSidebar.isOpen ? "sm:w-2/3" : ""} `}
        />

        <Sidebar
          isOpen={leftSidebar.isOpen}
          onClose={leftSidebar.close}
          editor={editor}
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
    </EditorContext.Provider>
  );
};

export default BlockEditor;

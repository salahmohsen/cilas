"use client";

import { Editor, EditorContent, PureEditorContent } from "@tiptap/react";
import React, { useMemo, useRef } from "react";

import { LinkMenu } from "@/tipTap/components/menus";

import "@/tipTap/styles/index.css";

import { Sidebar } from "@/tipTap/components/Sidebar";
import { EditorContext } from "@/tipTap/context/EditorContext";
import ImageBlockMenu from "@/tipTap/extensions/ImageBlock/components/ImageBlockMenu";
import { ColumnsMenu } from "@/tipTap/extensions/MultiColumn/menus";
import { TableColumnMenu, TableRowMenu } from "@/tipTap/extensions/Table/menus";
import { EditorHeader } from "../EditorHeader";
import { TextMenu } from "../menus/TextMenu";
import { ContentItemMenu } from "../menus/ContentItemMenu";
import { SidebarState } from "@/tipTap/hooks/useSidebar";

type BlockEditorProps = {
  editor: Editor | null;
  characterCount: {
    characters: () => number;
    words: () => number;
  };
  leftSidebar: SidebarState;
  children?: React.ReactNode;
};

export const BlockEditor = ({
  children,
  editor,
  characterCount,
  leftSidebar,
}: BlockEditorProps) => {
  const menuContainerRef = useRef(null);
  const editorRef = useRef<PureEditorContent | null>(null);

  const providerValue = useMemo(() => {
    return {};
  }, []);

  if (!editor) {
    return null;
  }

  return (
    <EditorContext.Provider value={providerValue}>
      <div className="flex h-full" ref={menuContainerRef}>
        <Sidebar
          isOpen={leftSidebar.isOpen}
          onClose={leftSidebar.close}
          editor={editor}
        />
        <div className="relative flex h-full flex-1 flex-col overflow-hidden">
          <EditorHeader
            characters={characterCount.characters()}
            words={characterCount.words()}
            isSidebarOpen={leftSidebar.isOpen}
            toggleSidebar={leftSidebar.toggle}
          >
            {children}
          </EditorHeader>
          <EditorContent
            editor={editor}
            ref={editorRef}
            className="flex-1 overflow-y-auto"
          />
          <ContentItemMenu editor={editor} />
          <LinkMenu editor={editor} appendTo={menuContainerRef} />
          <TextMenu editor={editor} />
          <ColumnsMenu editor={editor} appendTo={menuContainerRef} />
          <TableRowMenu editor={editor} appendTo={menuContainerRef} />
          <TableColumnMenu editor={editor} appendTo={menuContainerRef} />
          <ImageBlockMenu editor={editor} appendTo={menuContainerRef} />
        </div>
      </div>
    </EditorContext.Provider>
  );
};

export default BlockEditor;

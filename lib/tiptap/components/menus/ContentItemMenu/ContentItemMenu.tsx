import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { Toolbar } from "@/lib/tiptap/components/ui/Toolbar";
import DragHandle from "@tiptap-pro/extension-drag-handle-react";
import { Editor } from "@tiptap/react";

import { DropdownButton } from "@/lib/tiptap/components/ui/Dropdown";
import { Surface } from "@/lib/tiptap/components/ui/Surface";
import * as Popover from "@radix-ui/react-popover";
import { useEffect, useState } from "react";
import useContentItemActions from "./hooks/useContentItemActions";
import { useData } from "./hooks/useData";

export type ContentItemMenuProps = {
  editor: Editor;
};

export const ContentItemMenu = ({ editor }: ContentItemMenuProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const data = useData();
  const actions = useContentItemActions(editor, data.currentNode, data.currentNodePos);

  useEffect(() => {
    if (menuOpen) {
      editor.commands.setMeta("lockDragHandle", true);
    } else {
      editor.commands.setMeta("lockDragHandle", false);
    }
  }, [editor, menuOpen]);
  return (
    <DragHandle
      pluginKey="ContentItemMenu"
      editor={editor}
      onNodeChange={data.handleNodeChange}
      tippyOptions={{
        zIndex: 20,
      }}
    >
      <div className="mt-0.5 flex items-center gap-0.5">
        <Toolbar.Button onClick={actions.handleAdd} className="h-8 w-8">
          <Icon name="Plus" />
        </Toolbar.Button>
        <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Popover.Trigger asChild>
            <Toolbar.Button className="h-8 w-8">
              <Icon name="GripVertical" />
            </Toolbar.Button>
          </Popover.Trigger>
          <Popover.Content side="bottom" align="start" sideOffset={8}>
            <Surface className="flex min-w-[16rem] flex-col p-2 *:cursor-pointer">
              <Popover.Close asChild>
                <DropdownButton onClick={actions.resetTextFormatting}>
                  <Icon name="RemoveFormatting" />
                  Clear formatting
                </DropdownButton>
              </Popover.Close>
              <Popover.Close asChild>
                <DropdownButton onClick={actions.copyNodeToClipboard}>
                  <Icon name="Clipboard" />
                  Copy to clipboard
                </DropdownButton>
              </Popover.Close>
              <Popover.Close asChild>
                <DropdownButton onClick={actions.duplicateNode}>
                  <Icon name="Copy" />
                  Duplicate
                </DropdownButton>
              </Popover.Close>
              <Toolbar.Divider horizontal />
              <Popover.Close asChild>
                <DropdownButton
                  onClick={actions.deleteNode}
                  className="bg-destructive bg-opacity-10 hover:bg-opacity-20 dark:hover:bg-opacity-20 hover:bg-red-500"
                >
                  <Icon name="Trash2" />
                  Delete
                </DropdownButton>
              </Popover.Close>
            </Surface>
          </Popover.Content>
        </Popover.Root>
      </div>
    </DragHandle>
  );
};

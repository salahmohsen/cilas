import React, { useCallback, useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Toolbar } from "@/lib/tiptap/components/ui/Toolbar";
import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { Surface } from "@/lib/tiptap/components/ui/Surface";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/lib/tiptap/components/ui/Button";

export const ImageBlockAltUpdate = ({ onUpdate, editor }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [alt, setAlt] = useState("");

  useEffect(() => {
    // Update local state when the editor's alt attribute changes
    const currentAlt = editor.getAttributes("imageBlock").alt || "";
    setAlt(currentAlt);
  }, [editor, menuOpen]);

  const handleUpdate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onUpdate(alt);
      setMenuOpen(false);
    },
    [alt, onUpdate],
  );

  return (
    <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
      <Popover.Trigger asChild>
        <Toolbar.Button>
          <Icon
            name="MessageSquareText"
            className="flex-none text-black dark:text-white"
          />
        </Toolbar.Button>
      </Popover.Trigger>
      <Popover.Content
        side="bottom"
        align="start"
        sideOffset={8}
        className="bg-background flex flex-col gap-2 rounded-md p-2"
      >
        <Surface className="p-2" withBorder={false}>
          <Textarea
            placeholder="Type image description here."
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            className="text-foreground"
          />
        </Surface>
        <Button
          variant="primary"
          buttonSize="small"
          type="button"
          onClick={(e) => handleUpdate(e)}
        >
          Set Alt
        </Button>
      </Popover.Content>
    </Popover.Root>
  );
};

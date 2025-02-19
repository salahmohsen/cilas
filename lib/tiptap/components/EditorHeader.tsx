import { Button } from "@/components/hoc/button";
import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { cn } from "@/lib/utils/utils";
import { EditorInfo } from "./EditorInfo";

export type EditorHeaderProps = {
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
  characters: number;
  words: number;
  submitButtons: JSX.Element;
};

export const EditorHeader = ({
  characters,
  words,
  isSidebarOpen,
  toggleSidebar,
  submitButtons,
}: EditorHeaderProps) => {
  return (
    <div
      className={cn(
        "fixed z-30 flex h-16 w-full items-center justify-end border-b px-4 py-2 sm:w-[calc(100%-4rem)] sm:px-8 md:justify-between",
        "bg-background/50 backdrop-blur-xs",
        isSidebarOpen && "bg-background",
      )}
    >
      <EditorInfo characters={characters} words={words} className="hidden sm:block" />
      <div className="md:w-inherit flex w-full items-center justify-between gap-x-2 sm:w-auto sm:gap-x-3">
        {submitButtons}
        <Button
          tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          onClick={(e) => {
            e.preventDefault();
            toggleSidebar?.();
          }}
          className={
            isSidebarOpen
              ? "border"
              : "text-foreground hover:text-background border bg-transparent"
          }
          icon={<Icon name={isSidebarOpen ? "PanelRightClose" : "PanelRight"} />}
        />
      </div>
    </div>
  );
};

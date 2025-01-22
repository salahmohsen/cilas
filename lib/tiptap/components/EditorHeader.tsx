import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { EditorInfo } from "./EditorInfo";
import { Toolbar } from "@/lib/tiptap/components/ui/Toolbar";
import { cn } from "@/lib/utils/utils";

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
        "fixed z-30 flex h-16 w-full items-center justify-between border-b px-4 py-2 sm:w-[calc(100%-4rem)] sm:px-8",
        "bg-background/50 backdrop-blur-sm",
        isSidebarOpen && "bg-background",
      )}
    >
      <EditorInfo characters={characters} words={words} className="hidden sm:block" />
      <div className="flex w-inherit items-center justify-between gap-x-2 sm:w-auto sm:gap-x-5">
        {submitButtons}
        <Toolbar.Button
          tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          onClick={(e) => {
            e.preventDefault();
            toggleSidebar?.();
          }}
          active={isSidebarOpen}
          className={isSidebarOpen ? "bg-transparent" : "border border-border"}
        >
          <Icon name={isSidebarOpen ? "PanelRightClose" : "PanelRight"} />
        </Toolbar.Button>
      </div>
    </div>
  );
};

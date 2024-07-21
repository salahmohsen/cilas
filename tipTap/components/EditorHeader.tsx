import { Icon } from "@/tipTap/components/ui/Icon";
import { EditorInfo } from "./EditorInfo";
import { Toolbar } from "@/tipTap/components/ui/Toolbar";
import { cn } from "@/lib/utils";

export type EditorHeaderProps = {
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
  characters: number;
  words: number;
};

export const EditorHeader = ({
  characters,
  words,
  isSidebarOpen,
  toggleSidebar,
}: EditorHeaderProps) => {
  return (
    <div
      className={cn(
        "fixed z-50 flex h-16 w-full items-center justify-between border-b px-6 py-2 sm:w-[calc(100vw-4rem)] sm:pr-8",
        "bg-background/50 backdrop-blur-sm",
        isSidebarOpen && "bg-background",
      )}
    >
      <EditorInfo characters={characters} words={words} />
      <div className="flex flex-row items-center gap-x-1.5">
        <div className="flex items-center gap-x-1.5">
          <Toolbar.Button
            tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={toggleSidebar}
            active={isSidebarOpen}
            className={isSidebarOpen ? "bg-transparent" : ""}
          >
            <Icon name={isSidebarOpen ? "PanelRightClose" : "PanelRight"} />
          </Toolbar.Button>
        </div>
      </div>
    </div>
  );
};

import { Icon } from "@/tipTap/components/ui/Icon";
import { EditorInfo } from "./EditorInfo";
import { Toolbar } from "@/tipTap/components/ui/Toolbar";

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
    <div className="fixed z-50 flex w-full items-center justify-between border-b bg-background/50 px-6 py-2 backdrop-blur-sm sm:w-[calc(100vw-3rem)]">
      <div className="flex flex-row items-center gap-x-1.5">
        <div className="flex items-center gap-x-1.5">
          <Toolbar.Button
            tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={toggleSidebar}
            active={isSidebarOpen}
            className={isSidebarOpen ? "bg-transparent" : ""}
          >
            <Icon name={isSidebarOpen ? "PanelLeftClose" : "PanelLeft"} />
          </Toolbar.Button>
        </div>
      </div>
      <EditorInfo characters={characters} words={words} />
    </div>
  );
};

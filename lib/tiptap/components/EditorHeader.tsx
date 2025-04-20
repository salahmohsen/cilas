import { Button } from "@/components/hoc/button";
import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { cn } from "@/lib/utils/utils";
import { ReactNode, useState } from "react";
import { EditorInfo } from "./EditorInfo";

export type EditorHeaderProps = {
  isSidebarOpen?: boolean;
  toggleSidebar?: () => void;
  characters: number;
  words: number;
  children?: ReactNode;
};

export const EditorHeader = ({
  characters,
  words,
  isSidebarOpen,
  toggleSidebar,
  children,
}: EditorHeaderProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div
      className={cn(
        "absolute z-30 flex h-max w-full items-center justify-end border-b px-4 sm:pr-0 sm:pl-6 md:justify-between",
        "bg-background/50 backdrop-blur-xs",
        isSidebarOpen && "bg-background",
      )}
    >
      <EditorInfo characters={characters} words={words} className="hidden sm:block" />
      <div className="flex w-full items-center justify-between gap-x-2 sm:w-auto sm:gap-x-4">
        {children}
        <Button
          tooltip={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          onClick={(e) => {
            e.preventDefault();
            toggleSidebar?.();
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "rounded-none border-y-0",
            isSidebarOpen
              ? "border"
              : "text-foreground hover:text-background border bg-transparent",
          )}
          icon={
            <Icon
              name={
                isSidebarOpen && isHovered
                  ? "ArrowRightToLine"
                  : isSidebarOpen && !isHovered
                    ? "PanelRightClose"
                    : !isSidebarOpen && !isHovered
                      ? "PanelRight"
                      : "ArrowLeftToLine"
              }
            />
          }
        />
      </div>
    </div>
  );
};

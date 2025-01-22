import { memo } from "react";
import { cn } from "../lib/utils";

export type EditorInfoProps = {
  characters: number;
  words: number;
  className: string;
};

export const EditorInfo = memo(({ characters, words, className }: EditorInfoProps) => {
  return (
    <div className={cn("flex items-center", className)}>
      <div className="flex justify-center gap-5 text-right text-muted-foreground">
        <div className="text-xs font-semibold">
          {words} {words === 1 ? "word" : "words"}
        </div>
        <div className="text-xs font-semibold">
          {characters} {characters === 1 ? "character" : "characters"}
        </div>
      </div>
    </div>
  );
});

EditorInfo.displayName = "EditorInfo";

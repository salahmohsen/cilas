import { memo } from "react";

export type EditorInfoProps = {
  characters: number;
  words: number;
};

export const EditorInfo = memo(({ characters, words }: EditorInfoProps) => {
  return (
    <div className="flex items-center">
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

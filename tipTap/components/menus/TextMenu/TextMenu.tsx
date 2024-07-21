import { Icon } from "@/tipTap/components/ui/Icon";
import { Toolbar } from "@/tipTap/components/ui/Toolbar";
import { useTextmenuCommands } from "./hooks/useTextmenuCommands";
import { useTextmenuStates } from "./hooks/useTextmenuStates";
import { BubbleMenu, Editor } from "@tiptap/react";
import { memo, use, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Surface } from "@/tipTap/components/ui/Surface";
import { ColorPicker } from "@/tipTap/components/panels";
import { FontSizePicker } from "./components/FontSizePicker";
import { useTextmenuContentTypes } from "./hooks/useTextmenuContentTypes";
import { ContentTypePicker } from "./components/ContentTypePicker";
import { EditLinkPopover } from "./components/EditLinkPopover";

// We memorize the button so each button is not rerendered
// on every editor state change
const MemoButton = memo(Toolbar.Button);
const MemoColorPicker = memo(ColorPicker);
const MemoFontSizePicker = memo(FontSizePicker);
const MemoContentTypePicker = memo(ContentTypePicker);

export type TextMenuProps = {
  editor: Editor;
};

export const TextMenu = ({ editor }: TextMenuProps) => {
  const commands = useTextmenuCommands(editor);
  const states = useTextmenuStates(editor);
  const blockOptions = useTextmenuContentTypes(editor);
  return (
    <span>
      <BubbleMenu
        tippyOptions={{
          popperOptions: {
            placement: "bottom-start",
          },
        }}
        editor={editor}
        pluginKey="textMenu"
        shouldShow={states.shouldShow}
        updateDelay={100}
      >
        <Toolbar.Wrapper>
          <MemoContentTypePicker options={blockOptions} />
          <MemoFontSizePicker
            onChange={commands.onSetFontSize}
            value={states.currentSize || ""}
          />
          <Toolbar.Divider />
          <MemoButton
            tooltip="Bold"
            tooltipShortcut={["Mod", "B"]}
            onClick={commands.onBold}
            active={states.isBold}
          >
            <Icon name="Bold" />
          </MemoButton>
          <MemoButton
            tooltip="Italic"
            tooltipShortcut={["Mod", "I"]}
            onClick={commands.onItalic}
            active={states.isItalic}
          >
            <Icon name="Italic" />
          </MemoButton>
          <MemoButton
            tooltip="Underline"
            tooltipShortcut={["Mod", "U"]}
            onClick={commands.onUnderline}
            active={states.isUnderline}
          >
            <Icon name="Underline" />
          </MemoButton>
          <MemoButton
            tooltip="Strikehrough"
            tooltipShortcut={["Mod", "Shift", "S"]}
            onClick={commands.onStrike}
            active={states.isStrike}
          >
            <Icon name="Strikethrough" />
          </MemoButton>
          <MemoButton
            tooltip="Code"
            tooltipShortcut={["Mod", "E"]}
            onClick={commands.onCode}
            active={states.isCode}
          >
            <Icon name="Code" />
          </MemoButton>
          <MemoButton tooltip="Code block" onClick={commands.onCodeBlock}>
            <Icon name="CodeXml" />
          </MemoButton>
          <EditLinkPopover onSetLink={commands.onLink} />

          <Popover.Root>
            <Popover.Trigger asChild>
              <MemoButton tooltip="More options">
                <Icon name="EllipsisVertical" />
              </MemoButton>
            </Popover.Trigger>
            <Popover.Content side="bottom" asChild>
              <Toolbar.Wrapper>
                <MemoButton
                  tooltip="Subscript"
                  tooltipShortcut={["Mod", "."]}
                  onClick={commands.onSubscript}
                  active={states.isSubscript}
                >
                  <Icon name="Subscript" />
                </MemoButton>
                <MemoButton
                  tooltip="Superscript"
                  tooltipShortcut={["Mod", ","]}
                  onClick={commands.onSuperscript}
                  active={states.isSuperscript}
                >
                  <Icon name="Superscript" />
                </MemoButton>
                <Toolbar.Divider />
                <MemoButton
                  tooltip="Align left"
                  tooltipShortcut={["Shift", "Mod", "L"]}
                  onClick={commands.onAlignLeft}
                  active={states.isAlignLeft}
                >
                  <Icon name="AlignLeft" />
                </MemoButton>
                <MemoButton
                  tooltip="Align center"
                  tooltipShortcut={["Shift", "Mod", "E"]}
                  onClick={commands.onAlignCenter}
                  active={states.isAlignCenter}
                >
                  <Icon name="AlignCenter" />
                </MemoButton>
                <MemoButton
                  tooltip="Align right"
                  tooltipShortcut={["Shift", "Mod", "R"]}
                  onClick={commands.onAlignRight}
                  active={states.isAlignRight}
                >
                  <Icon name="AlignRight" />
                </MemoButton>
                <MemoButton
                  tooltip="Justify"
                  tooltipShortcut={["Shift", "Mod", "J"]}
                  onClick={commands.onAlignJustify}
                  active={states.isAlignJustify}
                >
                  <Icon name="AlignJustify" />
                </MemoButton>
              </Toolbar.Wrapper>
            </Popover.Content>
          </Popover.Root>
        </Toolbar.Wrapper>
      </BubbleMenu>
    </span>
  );
};

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export interface OnPasteOptions {
  resetColor: boolean;
  removeEmptyTextStyle: boolean;
  resetAttributes: boolean;
  unsetAllMarks: boolean;
}

export const OnPaste = Extension.create<OnPasteOptions>({
  name: "onPaste",

  addOptions() {
    return {
      resetColor: true,
      removeEmptyTextStyle: true,
      resetAttributes: true,
      unsetAllMarks: true,
    };
  },

  addProseMirrorPlugins() {
    const plugin = new PluginKey(this.name);

    return [
      new Plugin({
        key: plugin,
        props: {
          handlePaste: (view, event, slice) => {
            if (
              event.clipboardData &&
              event.clipboardData.files.length > 0 &&
              !event.clipboardData.getData("text")
            ) {
              // If there are only files, let other handlers process it
              return false;
            }

            const { state, dispatch } = view;
            const { tr } = state;
            const { selection } = tr;

            // Insert the pasted content
            tr.replaceSelection(slice);

            dispatch(tr);

            // Find the range of the newly inserted content
            const start = selection.from;
            const end = start + slice.content.size;

            const chainCommands = this.editor
              .chain()
              .focus()
              .setTextSelection({ from: start, to: end });

            if (this.options.resetColor) {
              chainCommands.setMeta("addToHistory", false).unsetColor();
            }

            if (this.options.removeEmptyTextStyle) {
              chainCommands.removeEmptyTextStyle();
            }

            if (this.options.resetAttributes) {
              chainCommands
                .resetAttributes("paragraph", ["style", "class"])
                .resetAttributes("heading", ["style", "class"]);
            }
            if (this.options.unsetAllMarks) {
              chainCommands.unsetAllMarks();
            }

            chainCommands.run();

            return true; // Indicate that we've handled the paste event
          },
        },
      }),
    ];
  },
});

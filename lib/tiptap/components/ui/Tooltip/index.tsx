"use client";

import Tippy from "@tippyjs/react/headless";
import React, { useCallback } from "react";

import { TippyProps, TooltipProps } from "./types";

const isMac =
  typeof window !== "undefined"
    ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
    : false;

const ShortcutKey = ({ children }: { children: string }): JSX.Element => {
  const className =
    "inline-flex items-center justify-center w-5 h-5 p-1 text-[0.625rem] rounded font-semibold leading-none border border-neutral-200 text-neutral-500 border-b-2";

  if (children === "Mod") {
    return <kbd className={className}>{isMac ? "⌘" : "Ctrl"}</kbd>; // ⌃
  }

  if (children === "Shift") {
    return <kbd className={className}>⇧</kbd>;
  }

  if (children === "Alt") {
    return <kbd className={className}>{isMac ? "⌥" : "Alt"}</kbd>;
  }

  return <kbd className={className}>{children}</kbd>;
};

export const Tooltip = ({
  children,
  enabled = true,
  title,
  shortcut,
  tippyOptions = {},
}: TooltipProps): JSX.Element => {
  const renderTooltip = useCallback(
    (attrs: TippyProps) => (
      <span
        className="border-border bg-popover text-popover-foreground z-999 flex items-center gap-2 rounded-lg border px-2.5 py-1 shadow-xs"
        tabIndex={-1}
        data-placement={attrs["data-placement"]}
        data-reference-hidden={attrs["data-reference-hidden"]}
        data-escaped={attrs["data-escaped"]}
      >
        {title && (
          <span className="text-popover-foreground text-xs font-medium">{title}</span>
        )}
        {shortcut && (
          <span className="flex items-center gap-0.5">
            {shortcut.map((shortcutKey) => (
              <ShortcutKey key={shortcutKey}>{shortcutKey}</ShortcutKey>
            ))}
          </span>
        )}
      </span>
    ),
    [shortcut, title],
  );

  if (enabled) {
    return (
      <span>
        <Tippy
          delay={500}
          offset={[0, 8]}
          touch={false}
          zIndex={30}
          appendTo="parent"
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...tippyOptions}
          render={renderTooltip}
        >
          <span>{children}</span>
        </Tippy>
      </span>
    );
  }

  return <>{children}</>;
};

export default Tooltip;

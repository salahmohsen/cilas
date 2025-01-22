import { Icon } from "@/lib/tiptap/components/ui/Icon";
import { icons } from "lucide-react";
import { useMemo } from "react";

import * as Popover from "@radix-ui/react-popover";

import { Toolbar } from "@/lib/tiptap/components/ui/Toolbar";
import { Surface } from "@/lib/tiptap/components/ui/Surface";
import {
  DropdownButton,
  DropdownCategoryTitle,
} from "@/lib/tiptap/components/ui/Dropdown";

export type ContentTypePickerOption = {
  label: string;
  id: string;
  type: "option";
  disabled: () => boolean;
  isActive: () => boolean;
  onClick: () => void;
  icon: keyof typeof icons;
};

export type ContentTypePickerCategory = {
  label: string;
  id: string;
  type: "category";
};

export type ContentPickerOptions = Array<
  ContentTypePickerOption | ContentTypePickerCategory
>;

export type ContentTypePickerProps = {
  options: ContentPickerOptions;
};

const isOption = (
  option: ContentTypePickerOption | ContentTypePickerCategory,
): option is ContentTypePickerOption => option.type === "option";
const isCategory = (
  option: ContentTypePickerOption | ContentTypePickerCategory,
): option is ContentTypePickerCategory => option.type === "category";

export const ContentTypePicker = ({ options }: ContentTypePickerProps) => {
  const activeItem = useMemo(
    () => options.find((option) => option.type === "option" && option.isActive()),
    [options],
  );

  const memoTrigger = useMemo(
    () => (
      <Toolbar.Button active={activeItem?.id !== "paragraph" && !!activeItem?.type}>
        <Icon name={(activeItem?.type === "option" && activeItem.icon) || "Pilcrow"} />
        <Icon name="ChevronDown" className="h-2 w-2" />
      </Toolbar.Button>
    ),
    [activeItem],
  );

  return (
    <Popover.Root>
      <Popover.Trigger asChild>{memoTrigger}</Popover.Trigger>
      <Popover.Content side="bottom" asChild>
        <Surface className="flex max-h-60 flex-col gap-1 overflow-y-auto px-2 py-4">
          {options.map((option) => {
            if (isOption(option)) {
              return (
                <DropdownButton
                  key={option.id}
                  onClick={option.onClick}
                  isActive={option.isActive()}
                >
                  <Icon name={option.icon} className="mr-1 h-4 w-4" />
                  {option.label}
                </DropdownButton>
              );
            } else if (isCategory(option)) {
              return (
                <div className="mt-2 first:mt-0" key={option.id}>
                  <DropdownCategoryTitle key={option.id}>
                    {option.label}
                  </DropdownCategoryTitle>
                </div>
              );
            }
          })}
        </Surface>
      </Popover.Content>
    </Popover.Root>
  );
};

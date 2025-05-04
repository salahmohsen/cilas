import { ComboboxOption } from "@/components/ui/combobox";
import { MultipleSelectorProps, Option } from "@/components/ui/multipleSelector";
import { ReactNode } from "react";
import { FieldPath, FieldValues } from "react-hook-form";
import { ServerActionReturn } from "./server.actions";

export interface StandardProps<
  TData extends FieldValues,
  TName extends FieldPath<TData>,
> {
  name: TName;
  label?: string;
  placeholder?: string;
  description?: string;
  className?: string;
}

export interface TipTapInputProps<
  TData extends FieldValues,
  TName extends FieldPath<TData>,
> extends StandardProps<TData, TName> {
  editorToolbar?: boolean;
}

export interface BasicInputProps<
  TData extends FieldValues,
  TName extends FieldPath<TData>,
> extends StandardProps<TData, TName> {
  type: "text" | "number" | "url" | "file" | "tel" | "email" | "date";
  direction?: "vertical" | "horizontal";
}

export interface SelectProps<TData extends FieldValues, TName extends FieldPath<TData>>
  extends StandardProps<TData, TName> {
  options: {
    groupLabel?: string;
    selectItems: string[];
  }[];
}

export interface MultipleSelectorInputProps<
  TData extends FieldValues,
  TName extends FieldPath<TData>,
> extends StandardProps<TData, TName>,
    MultipleSelectorProps {
  emptyMsg?: string;
  getPreValuesAction?: () => Promise<Option[]>;
}

export interface ComboBoxProps<TData extends FieldValues, TName extends FieldPath<TData>>
  extends StandardProps<TData, TName> {
  emptyMsg: string;
  disableSearch?: boolean;
  searchPlaceholder?: string;
  action: (
    query?: string,
  ) => Promise<ServerActionReturn & { data: ComboboxOption[] | null }>;
  initialLoading?: boolean;
  initialOptions?: Option[];
  defaultOption?: Option;
  children?: ReactNode;
}

export interface SliderProps<TData extends FieldValues, TName extends FieldPath<TData>>
  extends StandardProps<TData, TName> {
  defaultValue: [number, number];
  max: number;
  min: number;
  step: number;
  minStepsBetweenThumbs: number;
  formatLabelSign: string;
}

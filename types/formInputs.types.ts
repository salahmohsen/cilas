import { FieldPath, FieldValues } from "react-hook-form";
import { courseSchema } from "./course.schema";
import { z } from "zod";
import { SafeUser } from "./drizzle.types";
import { FellowSchema } from "./fellow.schema";

export interface StandardProps<
  TName extends FieldPath<FieldValues> = FieldPath<
    z.infer<typeof courseSchema> | z.infer<typeof FellowSchema>
  >,
> {
  name: TName;
  label?: string;
  placeholder: string;
  className?: string;
}

export interface BasicInputProps extends StandardProps {
  type: "text" | "number" | "url" | "file" | "tel" | "email";
  direction?: "vertical" | "horizontal";
}

export interface SelectProps extends StandardProps {
  options: {
    groupLabel?: string;
    selectItems: string[];
  }[];
}

export interface MultiSelectorProps extends StandardProps {
  options: { label: string; value: string }[];
  emptyMsg?: string;
}
export type ComboBoxOption = {
  id: string;
  name: string;
};
export interface ComboBoxProps extends StandardProps {
  emptyMsg: string;
  searchPlaceholder: string;
  action: () => Promise<void>;
  loading: boolean;
  options: ComboBoxOption[];
  defaultOption: ComboBoxOption | undefined;
}

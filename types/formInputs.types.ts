import { FieldPath, FieldValues } from "react-hook-form";
import { CourseSchema } from "./course.schema";
import { FellowSchema } from "./fellow.schema";
import { BundleSchema } from "./bundle.schema";
import { Option } from "@/components/ui/multipleSelector";

export interface StandardProps<
  TName extends FieldPath<FieldValues> = FieldPath<
    CourseSchema | FellowSchema | BundleSchema
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
  options?: { label: string; value: string }[];
  emptyMsg?: string;
  onSearch?: ((value: string) => Promise<Option[]>) | undefined;
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

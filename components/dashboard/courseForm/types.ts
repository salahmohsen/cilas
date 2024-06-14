import { FieldPath, FieldValues } from "react-hook-form";
import { CourseFormSchema } from "./courseFormSchema";
import { z } from "zod";
import { UserType, users } from "@/db/schema";

export type StandardProps<
  TName extends FieldPath<FieldValues> = FieldPath<CourseFormSchema>,
> = {
  name: TName;
  label?: string;
  placeholder: string;
  className?: string;
};

export interface BasicInputProps extends StandardProps {
  type: "text" | "number" | "url" | "file";
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

export interface ComboBoxProps extends StandardProps {
  emptyMsg: string;
  searchPlaceholder: string;
  fetchItemsAction: () => Promise<
    {
      id: number;
      name: string;
    }[]
  >;
  editMode: boolean;
  id?: number;
  fetchItemByIdAction: (id: number) => Promise<UserType>;
}

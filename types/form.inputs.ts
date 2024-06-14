import { FieldPath, FieldValues } from "react-hook-form";
import { courseFormSchema } from "./courseForm.schema";
import { userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

export type StandardProps<
  TName extends FieldPath<FieldValues> = FieldPath<
    z.infer<typeof courseFormSchema>
  >,
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
  fetchItemByIdAction: (id: number) => InferSelectModel<typeof userTable>;
}

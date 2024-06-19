import { FieldPath, FieldValues } from "react-hook-form";
import { courseSchema } from "./courseForm.schema";
import { userTable } from "@/db/schema";
import { InferSelectModel } from "drizzle-orm";
import { z } from "zod";

export type StandardProps<
  TName extends FieldPath<FieldValues> = FieldPath<
    z.infer<typeof courseSchema>
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
      id: string;
      name: string;
    }[]
  >;
  editMode: boolean;
  id?: string;
  fetchItemByIdAction: (id: string) => InferSelectModel<typeof userTable>;
}

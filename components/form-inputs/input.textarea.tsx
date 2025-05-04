import { memo } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

import { FormFieldWrapper } from "@/components/form-inputs/form.field.wrapper";
import { StandardProps } from "@/lib/types/form.inputs.types";
import { cn } from "@/lib/utils/utils";
import { Textarea as TextareaShcn } from "../ui/textarea";

const Textarea = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
}: StandardProps<TData, TName>) => {
  return (
    <FormFieldWrapper<TData, TName>
      name={name}
      label={label}
      itemClasses={cn("space-y-5", className)}
    >
      {({ field, fieldState }) => {
        const value = field.value;
        const onChange = field.onChange;

        return (
          <TextareaShcn
            {...field}
            className="col-span-1"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
          />
        );
      }}
    </FormFieldWrapper>
  );
};

export default memo(Textarea) as typeof Textarea;

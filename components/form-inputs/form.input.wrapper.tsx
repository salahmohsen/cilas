"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FieldPath, FieldValues, useFormContext } from "react-hook-form";
import { FormFieldProviderProps } from "../../lib/types/form.inputs.types";

export const FormFieldProvider = <
  TData extends FieldValues,
  TName extends FieldPath<TData>,
>({
  name,
  label,
  itemClasses,
  labelClasses,
  controlClasses,
  messageClasses,
  children,
  ...props
}: FormFieldProviderProps<TData, TName>) => {
  const { control } = useFormContext<TData, TName>();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={itemClasses}>
          {label && <FormLabel className={labelClasses}>{label}</FormLabel>}
          <FormControl className={controlClasses}>
            {children({ field, fieldState })}
          </FormControl>
          <FormMessage className={messageClasses} />
        </FormItem>
      )}
      {...props}
    />
  );
};

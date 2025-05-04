"use client";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import * as React from "react";
import {
  Control,
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  useFormContext,
} from "react-hook-form";

export function FormFieldWrapper<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TContext = any,
>({
  name,
  control,
  label,
  itemClasses,
  labelClasses,
  controlClasses,
  messageClasses,
  children,
  ...props
}: {
  name: TName;
  control?: Control<TFieldValues, TContext>;
  label?: string;
  itemClasses?: string;
  labelClasses?: string;
  controlClasses?: string;
  messageClasses?: string;
  children: (props: {
    field: ControllerRenderProps<TFieldValues, TName>;
    fieldState: ControllerFieldState;
  }) => React.ReactNode;
}) {
  const form = useFormContext<TFieldValues, TContext, TFieldValues>();

  return (
    <FormField<TFieldValues, TName>
      control={control || form.control}
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
}

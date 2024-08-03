import React, { memo, ComponentProps, ReactElement } from "react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { StandardProps } from "@/types/formInputs.types";

interface WrapperProps extends StandardProps {
  Input: React.ComponentType<any> | ReactElement;
  inputProps?: ComponentProps<React.ComponentType<any>>;
  readOnly?: boolean;
}

export const InputWrapper = memo(
  ({
    Input,
    inputProps = {},
    name,
    label,
    description,
    placeholder,
    className,
    readOnly = false,
  }: WrapperProps) => {
    const { control } = useFormContext();

    const renderInput = (field: any) => {
      const commonProps = {
        ...field,
        ...inputProps,
        readOnly: readOnly,
        disabled: readOnly,
        "aria-readonly": readOnly,
      };

      if (React.isValidElement(Input)) {
        return React.cloneElement(Input, commonProps);
      } else if (typeof Input === "function") {
        return <Input {...commonProps} placeholder={placeholder} />;
      }
      return null;
    };

    return (
      <FormField
        control={control}
        name={name}
        render={(field) => (
          <FormItem className={cn("space-y-2", className)}>
            {label && <FormLabel>{label}</FormLabel>}
            <FormControl>{renderInput(field)}</FormControl>
            {description && <FormDescription>{description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
);

InputWrapper.displayName = "InputWrapper";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormContext } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

import { SelectProps } from "@/lib/types/formInputs.types";
import React, { memo } from "react";

export const SelectInput: React.FC<SelectProps> = memo(function SelectInput({
  name,
  label,
  placeholder,
  className,
  options,
}) {
  const { control } = useFormContext();

  const handleChange = (selectedOption, onChange) => {
    if (selectedOption?.toLowerCase() === "open") {
      onChange(true);
    } else if (selectedOption?.toLowerCase() === "closed") {
      onChange(false);
    } else {
      onChange(selectedOption?.toLowerCase());
    }
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel asChild>
            <legend>{label}</legend>
          </FormLabel>
          <FormControl>
            <div onBlur={field.onBlur} ref={field.ref}>
              <Select
                name={field.name}
                defaultValue={
                  typeof field.value !== "boolean" ? field.value : undefined
                }
                disabled={field.disabled}
                onValueChange={(selectOption) =>
                  handleChange(selectOption, field.onChange)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      field.value && typeof field.value === "string"
                        ? field.value?.toLowerCase()
                        : field.value === true
                          ? "open"
                          : field.value === false
                            ? "closed"
                            : placeholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options?.map((selectOption, index) => {
                    if (selectOption.groupLabel) {
                      return (
                        <React.Fragment key={index}>
                          <SelectGroup>
                            <SelectLabel>{selectOption.groupLabel}</SelectLabel>
                            {selectOption.selectItems.map((option) => (
                              <SelectItem
                                key={option}
                                value={option?.toLowerCase()}
                              >
                                {option}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                          {index !== options.length - 1 && <SelectSeparator />}
                        </React.Fragment>
                      );
                    } else {
                      return selectOption.selectItems.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ));
                    }
                  })}
                </SelectContent>
              </Select>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

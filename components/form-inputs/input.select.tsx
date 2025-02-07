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
import { FieldPath, FieldValues } from "react-hook-form";

import { InputWrapper } from "@/components/form-inputs/form.input.wrapper";
import { SelectProps } from "@/lib/types/form.inputs.types";
import React, { memo } from "react";

const SelectInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
  options,
}: SelectProps<TData, TName>) => {
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
    <InputWrapper<TData, TName> name={name} label={label} itemClasses={className}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <div onBlur={field.onBlur} ref={field.ref}>
            <Select
              name={field.name}
              defaultValue={typeof value !== "boolean" ? value : undefined}
              disabled={field.disabled}
              onValueChange={(selectOption) => handleChange(selectOption, setValue)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    value && typeof value === "string"
                      ? value?.toLowerCase()
                      : value === true
                        ? "open"
                        : value === false
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
                            <SelectItem key={option} value={option?.toLowerCase()}>
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
        );
      }}
    </InputWrapper>
  );
};

export default memo(SelectInput) as typeof SelectInput;

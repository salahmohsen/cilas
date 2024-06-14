import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../components/ui/form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormContext } from "react-hook-form";

import { SelectProps } from "../../../../types/form.inputs";
import { memo } from "react";

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
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div onBlur={field.onBlur} ref={field.ref}>
              <Select
                name={field.name}
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
                        : placeholder
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {options?.map((selectOption) => {
                    if (selectOption.groupLabel) {
                      return (
                        <SelectGroup key={selectOption.groupLabel}>
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

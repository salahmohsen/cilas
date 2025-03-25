import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { FieldPath, FieldValues } from "react-hook-form";

import { FormControl } from "@/components/ui/form";

import { Button } from "@/components/hoc/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { InputWrapper } from "@/components/form-inputs/form.input.wrapper";
import { StandardProps } from "@/lib/types/form.inputs.types";
import { CalendarIcon } from "lucide-react";
import { memo } from "react";

const DateInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
}: StandardProps<TData, TName>) => {
  return (
    <InputWrapper<TData, TName>
      name={name}
      label={label}
      itemClasses={className}
      labelClasses="min-w-max"
    >
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            <input hidden {...field} />
            <Popover>
              <PopoverTrigger asChild className="dark:bg-input/30">
                <FormControl>
                  <Button
                    variant={"outline"}
                    disabled={field.disabled}
                    className={cn(
                      "my-0 w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground",
                    )}
                  >
                    {field.value ? (
                      format(field.value, "PPP")
                    ) : (
                      <span>{placeholder}</span>
                    )}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  disabled={field.disabled}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </>
        );
      }}
    </InputWrapper>
  );
};

export default memo(DateInput) as typeof DateInput;

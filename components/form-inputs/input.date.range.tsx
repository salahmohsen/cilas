import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { FormFieldProvider } from "@/components/form-inputs/form.input.wrapper";
import { StandardProps } from "@/lib/types/form.inputs.types";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { memo } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

const DateRangeInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
}: StandardProps<TData, TName>) => {
  return (
    <FormFieldProvider<TData, TName> name={name} label={label} itemClasses={className}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            <input hidden name={name} value={JSON.stringify(value)} onChange={setValue} />
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    id="date"
                    variant="outline"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !value.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {String(value.from) === String(value.to) ? (
                      <span>Pick a date</span>
                    ) : value?.from ? (
                      value.to ? (
                        <>
                          {format(value.from, "LLL dd, y")} -{" "}
                          {format(value.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(value.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={value?.from}
                  selected={value}
                  onSelect={setValue}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date("2011-01-01")}
                />
              </PopoverContent>
            </Popover>
          </>
        );
      }}
    </FormFieldProvider>
  );
};

export default memo(DateRangeInput) as typeof DateRangeInput;

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { StandardProps } from "@/lib/types/formInputs.types";
import { useFormContext } from "react-hook-form";
import { memo } from "react";

export const DateRangeInput: React.FC<StandardProps> = memo(
  function DateRangeInput({ name, label, placeholder, className }) {
    const { control } = useFormContext();

    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <FormLabel htmlFor={name}>{label}</FormLabel>
            <input
              hidden
              name={name}
              value={JSON.stringify(field.value)}
              onChange={field.onChange}
            />
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
                      !field.value.from && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {String(field.value.from) === String(field.value.to) ? (
                      <span>Pick a date</span>
                    ) : field.value?.from ? (
                      field.value.to ? (
                        <>
                          {format(field.value.from, "LLL dd, y")} -{" "}
                          {format(field.value.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(field.value.from, "LLL dd, y")
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
                  defaultMonth={field.value?.from}
                  selected={field.value}
                  onSelect={field.onChange}
                  numberOfMonths={2}
                  disabled={(date) => date < new Date("2011-01-01")}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
);

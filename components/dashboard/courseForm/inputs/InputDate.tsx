import { memo } from "react";
import { useFormContext } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import {
  FormControl,
  FormDescription,
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

import { Calendar } from "@/components/ui/calendar";

import { Button } from "@/components/ui/button";

import { CalendarIcon } from "lucide-react";
import { StandardProps } from "@/types/formInputs.types";

export const DateInput = memo(
  ({ name, label, placeholder, className }: StandardProps) => {
    const { control } = useFormContext();

    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={cn("flex flex-col", className)}>
            <FormLabel>{label}</FormLabel>
            <input hidden {...field} />
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    disabled={field.disabled}
                    className={cn(
                      "w-full pl-3 text-left font-normal",
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

            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
);

DateInput.displayName = "DateInput";

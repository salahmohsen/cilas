import { Button } from "@/components/button";
import { Calendar } from "@/components/ui/calendar";
import { FormControl } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { forwardRef } from "react";

type DateProps = {
  name: string;
  disabled?: boolean;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onChange: (value: Date | undefined) => void;
  value: Date | undefined | null;
  placeholder: string;
  className?: string;
};

const DatePicker = forwardRef<HTMLButtonElement, DateProps>(
  ({ name, value, onChange, onBlur, disabled, placeholder, className }) => {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <FormControl>
            <Button
              name={name}
              variant={"outline"}
              disabled={disabled}
              onBlur={onBlur}
              className={cn(
                "my-0 w-full pl-3 text-left font-normal",
                !value && "text-muted-foreground",
                className,
              )}
            >
              {value ? format(value, "PPP") : <span>{placeholder}</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
            </Button>
          </FormControl>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value || undefined}
            onSelect={onChange}
            disabled={disabled}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  },
);

DatePicker.displayName = "DatePicker";

export { DatePicker };

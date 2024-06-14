import { memo, useRef } from "react";
import { Label } from "@/components/ui/label";
import { TimePickerInput } from "@/components/ui/time-picker-input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../components/ui/form";
import { StandardProps } from "../../../../types/form.inputs";
import { useFormContext } from "react-hook-form";

export const TimeInput: React.FC<StandardProps> = memo(function TimeInput({
  name,
  label,
  className,
}) {
  const { control } = useFormContext();
  // Refs for accessibility and changing input focus
  const startHourRef = useRef<HTMLInputElement>(null);
  const startMinuteRef = useRef<HTMLInputElement>(null);
  const endHourRef = useRef<HTMLInputElement>(null);
  const endMinuteRef = useRef<HTMLInputElement>(null);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="mt-6">{label}</FormLabel>
          <FormControl>
            <div
              className="flex items-center gap-5"
              ref={field.ref}
              onBlur={field.onBlur}
            >
              <div className="flex items-end gap-2" id="start-time">
                <div className="grid gap-1 text-center">
                  <Label className="text-xs">Hours</Label>
                  <input
                    hidden
                    name={name}
                    value={JSON.stringify(field.value)}
                    onChange={field.onChange}
                  />
                  <TimePickerInput
                    id="start-hour"
                    picker="hours"
                    date={field.value.from}
                    setDate={(updatedDate) =>
                      field.onChange({ ...field.value, from: updatedDate })
                    }
                    ref={startHourRef}
                    onRightFocus={() => startMinuteRef?.current?.focus()}
                    onLeftFocus={() => endMinuteRef?.current?.focus()}
                  />
                </div>
                <div className="grid gap-1 text-center">
                  <Label className="text-xs">Minutes</Label>
                  <TimePickerInput
                    id="start-minutes"
                    picker="minutes"
                    ref={startMinuteRef}
                    date={field.value.from}
                    setDate={(updatedDate) =>
                      field.onChange({ ...field.value, from: updatedDate })
                    }
                    onRightFocus={() => endHourRef?.current?.focus()}
                    onLeftFocus={() => startHourRef?.current?.focus()}
                  />
                </div>
              </div>
              <span className="mt-5">:</span>
              <div className="flex items-end gap-2" id="end-time">
                <div className="grid gap-1 text-center">
                  <Label htmlFor="hours" className="text-xs">
                    Hours
                  </Label>

                  <TimePickerInput
                    id="end-hour"
                    picker="hours"
                    date={field.value.to}
                    setDate={(updatedDate) =>
                      field.onChange({ ...field.value, to: updatedDate })
                    }
                    ref={endHourRef}
                    onRightFocus={() => endMinuteRef?.current?.focus()}
                    onLeftFocus={() => startMinuteRef?.current?.focus()}
                  />
                </div>
                <div className="grid gap-1 text-center">
                  <Label htmlFor="minutes" className="text-xs">
                    Minutes
                  </Label>
                  <TimePickerInput
                    id="end-minutes"
                    picker="minutes"
                    date={field.value.to}
                    setDate={(updatedDate) =>
                      field.onChange({ ...field.value, to: updatedDate })
                    }
                    ref={endMinuteRef}
                    onRightFocus={() => startHourRef?.current?.focus()}
                    onLeftFocus={() => endHourRef?.current?.focus()}
                  />
                </div>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

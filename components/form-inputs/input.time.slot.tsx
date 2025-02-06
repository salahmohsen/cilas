import { Label } from "@/components/ui/label";
import { TimePickerInput } from "@/components/ui/time-picker-input";
import { StandardProps } from "@/lib/types/formInputs.types";
import { cn } from "@/lib/utils/utils";
import { memo, useRef } from "react";
import { FieldPath, FieldValues } from "react-hook-form";
import { FormFieldProvider } from "./form.input.wrapper";

const TimeSlotInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  className,
}: StandardProps<TData, TName>) => {
  // Refs for accessibility and changing input focus
  const startHourRef = useRef<HTMLInputElement>(null);
  const startMinuteRef = useRef<HTMLInputElement>(null);
  const endHourRef = useRef<HTMLInputElement>(null);
  const endMinuteRef = useRef<HTMLInputElement>(null);

  return (
    <FormFieldProvider<TData, TName>
      name={name}
      label={label}
      itemClasses={cn("flex flex-col", className)}
      labelClasses="mb-3 min-w-max"
    >
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            <div className="flex w-full gap-5" ref={field.ref} onBlur={field.onBlur}>
              <div className="flex items-end gap-2" id="start-time">
                <div className="grid gap-1 text-center">
                  <Label className="text-xs" htmlFor="start-hour">
                    <span className="text-[0.6rem]">24</span>Hours
                  </Label>
                  <input
                    hidden
                    name={name}
                    value={JSON.stringify(value)}
                    onChange={setValue}
                  />
                  <TimePickerInput
                    id="start-hour"
                    picker="hours"
                    date={value.from}
                    setDate={(updatedDate) => setValue({ ...value, from: updatedDate })}
                    ref={startHourRef}
                    onRightFocus={() => startMinuteRef?.current?.focus()}
                    onLeftFocus={() => endMinuteRef?.current?.focus()}
                  />
                </div>
                <div className="grid gap-1 text-center">
                  <Label className="text-xs" htmlFor="start-minutes">
                    Minutes
                  </Label>
                  <TimePickerInput
                    id="start-minutes"
                    picker="minutes"
                    ref={startMinuteRef}
                    date={value.from}
                    setDate={(updatedDate) => setValue({ ...value, from: updatedDate })}
                    onRightFocus={() => endHourRef?.current?.focus()}
                    onLeftFocus={() => startHourRef?.current?.focus()}
                  />
                </div>
              </div>
              <span className="mt-6">:</span>
              <div className="flex items-end gap-2" id="end-time">
                <div className="grid gap-1 text-center">
                  <Label className="text-xs" htmlFor="end-hour">
                    <span className="text-[0.6rem]">24</span>Hours
                  </Label>

                  <TimePickerInput
                    id="end-hour"
                    picker="hours"
                    date={value.to}
                    setDate={(updatedDate) => setValue({ ...value, to: updatedDate })}
                    ref={endHourRef}
                    onRightFocus={() => endMinuteRef?.current?.focus()}
                    onLeftFocus={() => startMinuteRef?.current?.focus()}
                  />
                </div>
                <div className="grid gap-1 text-center">
                  <Label className="text-xs" htmlFor="end-minutes">
                    Minutes
                  </Label>
                  <TimePickerInput
                    id="end-minutes"
                    picker="minutes"
                    date={value.to}
                    setDate={(updatedDate) => setValue({ ...value, to: updatedDate })}
                    ref={endMinuteRef}
                    onRightFocus={() => startHourRef?.current?.focus()}
                    onLeftFocus={() => endHourRef?.current?.focus()}
                  />
                </div>
              </div>
            </div>
          </>
        );
      }}
    </FormFieldProvider>
  );
};

export default memo(TimeSlotInput) as typeof TimeSlotInput;

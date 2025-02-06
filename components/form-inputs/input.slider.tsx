import { FieldPath, FieldValues, useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Slider } from "@/components/ui/slider";
import { SliderProps } from "@/lib/types/form.inputs.types";
import { cn } from "@/lib/utils/utils";
import { memo } from "react";

const SliderInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  className,
  defaultValue,
  max,
  min,
  step,
  minStepsBetweenThumbs,
  formatLabelSign,
}: SliderProps<TData, TName>) => {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-col gap-3", className)}>
          <FormLabel asChild>
            <legend>{label}</legend>
          </FormLabel>
          <FormControl>
            <>
              <input
                hidden
                name={name}
                value={JSON.stringify(field.value)}
                onChange={field.onChange}
              />
              <Slider
                name={name}
                defaultValue={defaultValue}
                max={max}
                min={min}
                step={step}
                minStepsBetweenThumbs={minStepsBetweenThumbs}
                value={field.value}
                onValueChange={field.onChange}
                formatLabel={(value) => `${value} ${formatLabelSign}`}
              />
            </>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default memo(SliderInput) as typeof SliderInput;

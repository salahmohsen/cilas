import { memo } from "react";
import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Slider,
} from "@/components/ui/";

import { SliderProps } from "@/types/formInputs.types";
import { cn } from "@/lib/utils";

export const SliderInput: React.FC<SliderProps> = memo(function BasicInput({
  name,
  label,
  className,
  defaultValue,
  max,
  min,
  step,
  minStepsBetweenThumbs,
  formatLabelSign,
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("flex flex-col gap-3", className)}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <>
              <input
                hidden
                name={name}
                value={JSON.stringify(field.value)}
                onChange={field.onChange}
              />
              <Slider
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
});

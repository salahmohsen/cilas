import { memo } from "react";
import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { SliderProps } from "@/types/formInputs.types";
import { Slider } from "@/components/ui/slider";
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
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

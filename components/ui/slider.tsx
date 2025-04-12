import React, { useState, useRef, useEffect, useCallback } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils/utils";

type SliderProps = {
  name?: string;
  className?: string;
  min: number;
  max: number;
  defaultValue: [number, number];
  minStepsBetweenThumbs: number;
  step: number;
  formatLabel?: (value: number) => string;
  value?: number[] | readonly number[];
  onValueChange?: (values: number[]) => void;
};

type LabelPosition = {
  left: string;
  textAlign: "left" | "center" | "right";
};

const Slider = React.forwardRef(
  (
    {
      className,
      min,
      max,
      step,
      defaultValue,
      formatLabel,
      value,
      onValueChange,
      name,
      ...props
    }: SliderProps,
    ref,
  ) => {
    const [localValues, setLocalValues] = useState<number[]>(() => {
      if (Array.isArray(value)) return value;
      if (defaultValue) return defaultValue;
      return [min, max];
    });
    const sliderRef = useRef<HTMLDivElement>(null);
    const [labelWidths, setLabelWidths] = useState<number[]>([]);
    const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([]);

    const isControlled = value !== undefined;

    const handleValueChange = (newValues: number[]) => {
      if (!isControlled) {
        setLocalValues(newValues);
      }
      if (onValueChange) {
        onValueChange(newValues);
      }
    };

    const getLabelPosition = useCallback(
      (
        value: number,
        index: number,
        widths: number[],
        sliderWidth: number,
      ): LabelPosition => {
        const percentage = (value - min) / (max - min);
        const labelWidth = widths[index] || 0;

        const flipThreshold = 0.1; // 10% from either end
        const shouldFlip = percentage < flipThreshold || percentage > 1 - flipThreshold;

        let leftPosition;
        if (shouldFlip) {
          leftPosition =
            percentage < 0.5
              ? `${percentage * 100}%`
              : `${percentage * 100 - (labelWidth / sliderWidth) * 100}%`;
        } else {
          leftPosition = `${percentage * 100 - (labelWidth / 2 / sliderWidth) * 100}%`;
        }

        return {
          left: leftPosition,
          textAlign: shouldFlip ? (percentage < 0.5 ? "left" : "right") : "center",
        };
      },
      [min, max],
    );

    const adjustLabelPositions = useCallback(
      (
        positions: LabelPosition[],
        widths: number[],
        sliderWidth: number,
      ): LabelPosition[] => {
        const positionValues = positions.map((pos) => parseFloat(pos.left));
        const adjustedPositions = [...positions];

        for (let i = 0; i < positionValues.length - 1; i++) {
          const leftLabel = positionValues[i];
          const rightLabel = positionValues[i + 1];
          const leftWidth = (widths[i] / sliderWidth) * 100;
          const rightWidth = (widths[i + 1] / sliderWidth) * 100;
          const minGap = 2; // Minimum gap between labels in percentage

          if (rightLabel - leftLabel < leftWidth / 2 + rightWidth / 2 + minGap) {
            const overlap =
              leftWidth / 2 + rightWidth / 2 + minGap - (rightLabel - leftLabel);
            adjustedPositions[i].left = `${leftLabel - overlap / 2}%`;
            adjustedPositions[i + 1].left = `${rightLabel + overlap / 2}%`;

            // Ensure labels don't go out of bounds
            if (parseFloat(adjustedPositions[i].left) < 0) {
              adjustedPositions[i].left = "0%";
              adjustedPositions[i].textAlign = "left";
            }
            if (parseFloat(adjustedPositions[i + 1].left) > 100 - rightWidth) {
              adjustedPositions[i + 1].left = `${100 - rightWidth}%`;
              adjustedPositions[i + 1].textAlign = "right";
            }
          }
        }

        return adjustedPositions;
      },
      [],
    );

    useEffect(() => {
      if (isControlled && Array.isArray(value)) {
        setLocalValues(value);
      }
    }, [isControlled, value]);

    useEffect(() => {
      if (sliderRef.current) {
        const sliderWidth = sliderRef.current.offsetWidth;
        const newLabelWidths = localValues.map((value) => {
          const label = formatLabel ? formatLabel(value) : value.toString();
          const tempSpan = document.createElement("span");
          tempSpan.style.visibility = "hidden";
          tempSpan.style.position = "absolute";
          tempSpan.style.whiteSpace = "nowrap";
          tempSpan.textContent = label;
          document.body.appendChild(tempSpan);
          const width = tempSpan.offsetWidth;
          document.body.removeChild(tempSpan);
          return Math.min(width, sliderWidth / 2);
        });
        setLabelWidths(newLabelWidths);

        // Calculate initial positions
        const initialPositions = localValues.map((value, index) =>
          getLabelPosition(value, index, newLabelWidths, sliderWidth),
        );

        // Adjust positions to prevent collisions
        const adjustedPositions = adjustLabelPositions(
          initialPositions,
          newLabelWidths,
          sliderWidth,
        );
        setLabelPositions(adjustedPositions);
      }
    }, [localValues, formatLabel, getLabelPosition, adjustLabelPositions]);

    return (
      <SliderPrimitive.Root
        ref={ref as React.RefObject<HTMLDivElement>}
        name={name}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        value={localValues}
        onValueChange={handleValueChange}
        className={cn(
          "relative flex w-full touch-none items-center pb-8 select-none",
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track className="bg-primary/20 relative h-1.5 w-full grow overflow-hidden rounded-full">
          <SliderPrimitive.Range className="bg-primary absolute h-full" />
        </SliderPrimitive.Track>
        <div ref={sliderRef} className="absolute inset-0 -mt-[5px]">
          {localValues.map((value, index) => (
            <React.Fragment key={index}>
              <div
                className="absolute top-0 mt-6"
                style={{
                  left: labelPositions[index]?.left,
                  textAlign: labelPositions[index]?.textAlign,
                  width: `${labelWidths[index]}px`,
                }}
              >
                <span className="inline-block max-w-full truncate text-sm">
                  {formatLabel ? formatLabel(value) : value}
                </span>
              </div>

              <SliderPrimitive.Thumb className="border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50" />
            </React.Fragment>
          ))}
        </div>
      </SliderPrimitive.Root>
    );
  },
);

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

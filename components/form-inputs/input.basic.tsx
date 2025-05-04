import Image from "next/image";
import { ChangeEvent, memo, useRef } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";

import { FormFieldWrapper } from "@/components/form-inputs/form.field.wrapper";
import { cloudinary_quality } from "@/lib/cloudinary/cloudinary.utils";
import { BasicInputProps } from "@/lib/types/form.inputs.types";
import { cn } from "@/lib/utils/utils";

const BasicInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  type,
  placeholder,
  className,
  direction = "vertical",
}: BasicInputProps<TData, TName>) => {
  // Use a ref for file input instead of controlled state
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <FormFieldWrapper<TData, TName>
      name={name}
      label={label}
      labelClasses={direction === "horizontal" ? "col-span-2" : "col-span-1 mt-1"}
      itemClasses={cn(
        direction === "horizontal"
          ? "grid grid-cols-7 items-center gap-2"
          : "grid grid-cols-1",
        className,
      )}
    >
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        // Handle file input separately from other input types
        if (type === "file") {
          const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
              setValue(file);
            }
          };

          return (
            <div
              className={`${direction === "horizontal" ? "col-span-5" : "col-span-1 flex items-center gap-5"}`}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept=".jpg, .jpeg, .png"
                placeholder={placeholder}
                onChange={handleFileChange}
              />
              {value && (
                <Image
                  src={cloudinary_quality(value, "low") || "/public/logo.png"}
                  className="h-10 w-auto rounded-md"
                  width={50}
                  height={50}
                  alt={label || ""}
                />
              )}
            </div>
          );
        }

        // All other input types (text, number, etc.)
        return (
          <div
            className={`${direction === "horizontal" ? "col-span-5" : "col-span-1 flex items-center gap-5"}`}
          >
            <Input
              {...field}
              type={type === "number" ? "text" : type}
              placeholder={placeholder}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        );
      }}
    </FormFieldWrapper>
  );
};

export default memo(BasicInput) as typeof BasicInput;

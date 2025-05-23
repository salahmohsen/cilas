import Image from "next/image";
import { ChangeEvent, memo, useState } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

import { Input } from "@/components/ui/input";

import { InputWrapper } from "@/components/form-inputs/form.input.wrapper";
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
  const [preview, setPreview] = useState<unknown>(undefined);
  const handleImageInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        if (reader.result) {
          setPreview(reader.result);
        }
      };
    }
  };

  return (
    <InputWrapper<TData, TName>
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

        return (
          <div
            className={` ${direction === "horizontal" ? "col-span-5" : "col-span-1 flex items-center gap-5"} `}
          >
            <Input
              {...field}
              type={type === "number" ? "text" : type}
              placeholder={placeholder}
              accept={type === "file" ? ".jpg, .jpeg, .png" : undefined}
              value={type === "file" ? undefined : value}
              onChange={(e) => {
                if (type !== "file") {
                  setValue(e.target.value);
                } else if (type === "file") {
                  handleImageInput(e);
                  setValue(e.target.files?.[0]);
                }
              }}
            />
            {(preview || (value && type === "file")) && (
              <>
                <Image
                  src={
                    (preview as string) ||
                    cloudinary_quality(value, "low") ||
                    "/public/logo.png"
                  }
                  className="h-10 w-auto rounded-md"
                  width={50}
                  height={50}
                  alt={label || ""}
                />
              </>
            )}
          </div>
        );
      }}
    </InputWrapper>
  );
};

export default memo(BasicInput) as typeof BasicInput;

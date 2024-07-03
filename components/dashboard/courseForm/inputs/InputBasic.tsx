import { ChangeEvent, memo, useState } from "react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Image from "next/image";

import { BasicInputProps } from "@/types/formInputs.types";
import { cloudinary_quality } from "@/lib/cloudinary.utils";
import { cn } from "@/lib/utils";

export const BasicInput: React.FC<BasicInputProps> = memo(function BasicInput({
  name,
  label,
  type,
  placeholder,
  className,
  direction = "vertical",
}) {
  const { control } = useFormContext();

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
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            direction === "horizontal"
              ? "grid grid-cols-7 items-center gap-2"
              : "grid grid-cols-1 gap-2",
            className,
          )}
        >
          <FormLabel
            className={direction === "horizontal" ? "col-span-2" : "col-span-1"}
          >
            {label}
          </FormLabel>
          <FormControl className="space-y-2">
            <div
              className={
                direction === "horizontal" ? "col-span-5" : "col-span-1"
              }
            >
              <Input
                type={type === "number" ? "text" : type}
                {...field}
                placeholder={placeholder}
                accept={type === "file" ? ".jpg, .jpeg, .png" : undefined}
                value={type === "file" ? undefined : field.value}
                onChange={(e) => {
                  if (type !== "file") {
                    field.onChange(e.target.value);
                  } else if (type === "file") {
                    handleImageInput(e);
                    field.onChange(e.target.files?.[0]);
                  }
                }}
              />
              {(preview || (field.value && type === "file")) && (
                <>
                  <Image
                    src={
                      (preview as string) ||
                      cloudinary_quality(field.value, "low") ||
                      "/public/logo.png"
                    }
                    className="h-10 w-auto rounded-md"
                    width={50}
                    height={50}
                    alt={label || ""}
                  />
                </>
              )}
              {direction === "horizontal" && <FormMessage />}
            </div>
          </FormControl>
          {direction === "vertical" && <FormMessage />}
        </FormItem>
      )}
    />
  );
});

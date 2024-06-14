import { ChangeEvent, memo, useState } from "react";
import { useFormContext } from "react-hook-form";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../ui/form";
import Image from "next/image";

import { BasicInputProps } from "./types";

export const BasicInput: React.FC<BasicInputProps> = memo(function BasicInput({
  name,
  label,
  type,
  placeholder,
  className,
}) {
  const { control } = useFormContext();

  const [preview, setPreview] = useState<string | undefined>(undefined);
  const handleImageInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
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
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex gap-2">
              <Input
                type={type}
                {...field}
                placeholder={placeholder}
                accept={type === "file" ? ".jpg, .jpeg, .png" : undefined}
                value={type === "file" ? undefined : field.value}
                onChange={(e) => {
                  if (type === "text" || type === "url") {
                    field.onChange(e.target.value);
                  } else if (type === "number") {
                    field.onChange(Number(e.target.value));
                  } else if (type === "file") {
                    handleImageInput(e);
                    field.onChange(e.target.files?.[0]);
                  }
                }}
              />
              {preview && type === "file" && (
                <Image
                  src={preview}
                  className="h-10 w-auto rounded-md"
                  width={10}
                  height={10}
                  alt={label ? label : ""}
                />
              )}
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
});

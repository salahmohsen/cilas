"use client";

import { FellowForm } from "@/app/(dashboard)/admin/course-management/_components/courses/fellow.form";
import { FormFieldProvider } from "@/components/form-inputs/form.input.wrapper";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComboBoxProps } from "@/lib/types/form.inputs.types";
import { cn } from "@/lib/utils/utils";
import { Check, ChevronsUpDown, LoaderCircle } from "lucide-react";
import { memo, useEffect, useState } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

const ComboBoxInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
  emptyMsg,
  searchPlaceholder,
  action,
  loading,
  options,
  defaultOption,
}: ComboBoxProps<TData, TName>) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) action();
  }, [open, action]);

  return (
    <FormFieldProvider<TData, TName> name={name} label={label}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            {/* Hidden input to keep the field registered */}
            <input
              hidden
              name={field.name}
              value={JSON.stringify(value)}
              onChange={setValue}
            />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className={cn(
                    "w-full justify-between",
                    !value && "text-muted-foreground",
                  )}
                >
                  {(() => {
                    if (value) {
                      // First check for matching option in options array
                      const selectedOption = options.find((item) => item.id === value);
                      if (selectedOption) return selectedOption.name;

                      // Then check defaultOption if no match found
                      if (defaultOption) return defaultOption.name;
                    }
                    return placeholder;
                  })()}

                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0 [&>*]:!z-[9969]" align="start">
                <Command
                  filter={(value, search, keywords) => {
                    if ([keywords]?.join()?.toLowerCase()?.includes(search.toLowerCase()))
                      return 1;
                    return 0;
                  }}
                >
                  <CommandList>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandEmpty>
                      <div className="space-y-2">
                        <p>{emptyMsg}</p>
                        <FellowForm mode="button" />
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {options?.map((option) => (
                        <CommandItem
                          keywords={[option?.name]}
                          key={option.id}
                          value={option.id}
                          id={field.name}
                          onSelect={(currentValue) => {
                            setValue(currentValue === value ? "" : currentValue);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === option.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {option.name || ""}
                        </CommandItem>
                      ))}
                      {!loading && options?.length !== 0 && (
                        <FellowForm mode="commandItem" />
                      )}
                      {loading && (
                        <CommandItem
                          disabled
                          className="grid animate-spin place-items-center"
                        >
                          <LoaderCircle />
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </>
        );
      }}
    </FormFieldProvider>
  );
};

export default memo(ComboBoxInput) as typeof ComboBoxInput;

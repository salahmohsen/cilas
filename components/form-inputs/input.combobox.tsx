"use client";

import { Button } from "@/components/button";
import { FormFieldWrapper } from "@/components/form-inputs/form.field.wrapper";
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
import { Option } from "../ui/multipleSelector";

const ComboBoxInput = <TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  className,
  disableSearch = false,
  emptyMsg,
  searchPlaceholder,
  action,
  initialLoading = false,
  initialOptions = [],
  defaultOption,
  children,
}: ComboBoxProps<TData, TName>) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(initialLoading);
  const [options, setOptions] = useState<Option[]>(initialOptions);

  // Fetch data based on search query
  useEffect(() => {
    const fetchData = async () => {
      if (!open) return;

      setLoading(true);
      try {
        // Call the action function with the current search query
        const results = await action(searchQuery);
        if (results.success && results.data) setOptions(results.data);
        if (results.error) throw new Error(results.message);
      } catch (error) {
        if (error instanceof Error)
          console.error("Error fetching options:", error.message);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the search to avoid too many requests
    const timeoutId = setTimeout(fetchData, 300);
    return () => clearTimeout(timeoutId);
  }, [open, searchQuery, action]);

  // Initial load when opening the dropdown
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      action("").then((results) => results.data && setOptions(results.data));
    }
  }, [open, action]);

  // Handle search input changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  return (
    <FormFieldWrapper<TData, TName> name={name} label={label}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            {/* Hidden input to keep the field registered */}
            <input hidden name={field.name} value={value} onChange={setValue} />
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild className="dark:bg-input/30">
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  className={cn(
                    "w-full *:w-full *:justify-between",
                    !value && "text-muted-foreground",
                  )}
                >
                  {(() => {
                    if (value) {
                      // First check for matching option in options array
                      const selectedOption = options.find((item) => item.value === value);
                      if (selectedOption) return selectedOption.label;

                      // Then check defaultOption if no match found
                      if (defaultOption) return defaultOption.label;
                    }
                    return placeholder;
                  })()}

                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 *:z-9969!"
                align="start"
              >
                <Command
                  filter={(value, search, keywords) => {
                    if ([keywords]?.join()?.toLowerCase()?.includes(search.toLowerCase()))
                      return 1;
                    return 0;
                  }}
                >
                  <CommandList>
                    {!disableSearch && (
                      <CommandInput
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onValueChange={handleSearchChange}
                      />
                    )}
                    <CommandEmpty>
                      <div className="space-y-2">
                        <p>{emptyMsg}</p>
                        {children}
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {options?.map((option) => (
                        <CommandItem
                          keywords={[option?.label]}
                          key={option.value}
                          value={option.value}
                          id={field.name}
                          onSelect={(currentValue) => {
                            setValue(currentValue === value ? "" : currentValue);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === option.value ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {option.label || ""}
                        </CommandItem>
                      ))}
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
    </FormFieldWrapper>
  );
};

export default memo(ComboBoxInput) as typeof ComboBoxInput;

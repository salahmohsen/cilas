"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

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
import { ServerActionReturn } from "@/lib/types/server.actions";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage } from "./avatar";

export type ComboboxOption = {
  value: string;
  label: string;
  avatar?: string | null;
};

interface AsyncSearchReturn extends ServerActionReturn {
  data: ComboboxOption[] | null;
}

type ComboboxProps = {
  name: string;
  btnPlaceholder: string;
  searchPlaceholder?: string;
  notFoundMsg: string;
  asyncSearch: () => Promise<AsyncSearchReturn>;
  className?: string;
  value?: string | number | readonly string[] | null;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};
const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      name,
      value,
      onChange,
      onBlur,
      btnPlaceholder,
      searchPlaceholder,
      notFoundMsg,
      asyncSearch,
      className,
      disabled = false,
    },
    ref,
  ) => {
    const [open, setOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [options, setOptions] = React.useState<ComboboxOption[]>([]);

    const selectedLabel = React.useMemo(() => {
      if (!value) return btnPlaceholder;
      const option = options.find((item) => item.value === value);
      return option?.label || btnPlaceholder;
    }, [value, options, btnPlaceholder]);

    const selectedAvatar = React.useMemo(() => {
      if (!value) return undefined;
      const option = options.find((item) => item.value === value);
      return option?.avatar;
    }, [value, options]);

    React.useEffect(() => {
      setIsLoading(true);
      asyncSearch().then((res) => {
        if (res.error) {
          console.error(res.message);
          return;
        }
        setOptions(res.data || []);
        setIsLoading(false);
      });
    }, [asyncSearch]);

    return (
      <>
        <Popover open={open && !disabled} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between", className)}
              onClick={(e) => {
                if (disabled) {
                  e.preventDefault();
                }
              }}
              name={name}
              onBlur={onBlur}
              disabled={disabled}
              ref={ref}
            >
              {isLoading ? (
                "Loading..."
              ) : (
                <div className="flex items-center gap-2">
                  {selectedAvatar && (
                    <Avatar className="h-7 w-7 rounded-sm">
                      <AvatarImage src={selectedAvatar} />
                    </Avatar>
                  )}
                  {selectedLabel}
                </div>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder={searchPlaceholder || "Search..."} />
              <CommandList>
                <CommandEmpty>{isLoading ? "Loading..." : notFoundMsg}</CommandEmpty>
                <CommandGroup>
                  {!isLoading &&
                    options.length > 0 &&
                    options.map((item) => (
                      <CommandItem
                        key={item.value}
                        value={item.value}
                        onSelect={(currentValue) => {
                          onChange?.(currentValue === value ? "" : currentValue);
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            value === item.value ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {item.label}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </>
    );
  },
);

Combobox.displayName = "Combobox";

export { Combobox };

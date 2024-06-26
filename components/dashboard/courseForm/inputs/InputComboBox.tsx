import { memo, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Ellipsis, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { ComboBoxProps } from "@/types/formInputs.types";
import { useFormContext } from "react-hook-form";

export const ComboBoxInput: React.FC<ComboBoxProps> = memo(
  function ComboBoxInput({
    name,
    label,
    placeholder,
    className,
    emptyMsg,
    searchPlaceholder,
    fetchItemsAction,
    editMode,
    preData,
  }) {
    const { control } = useFormContext();
    const [data, setData] = useState<{ id: string; name: string }[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    /* This useEffect used to fetch specific user in Edit Mode */
    useEffect(() => {
      const fetchData = async () => {
        if (open) {
          try {
            setLoading(true);
            const result = await fetchItemsAction();
            setLoading(false);
            if (result !== undefined) {
              setData(result);
            }
          } catch (error) {
            toast.error(`Failed to fetch ${label} data`);
            setData([]);
          }
        }
      };
      fetchData();
    }, [open, editMode, fetchItemsAction, label]);

    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <>
                <input
                  hidden
                  name={name}
                  value={field.value}
                  onChange={field.onChange}
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
                        !field.value && "text-muted-foreground",
                      )}
                    >
                      {field.value
                        ? `${preData?.firstName}  ${preData?.lastName}` ||
                          data?.find((item) => item?.id === field.value)?.name
                        : placeholder}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0" align="start">
                    <Command
                      filter={(value, search, keywords) => {
                        if (
                          [keywords]
                            ?.join()
                            ?.toLowerCase()
                            ?.includes(search.toLowerCase())
                        )
                          return 1;
                        return 0;
                      }}
                    >
                      <CommandList>
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandEmpty>{emptyMsg}</CommandEmpty>
                        <CommandGroup>
                          {data?.map((item) => (
                            <CommandItem
                              keywords={[item?.name]}
                              key={preData?.id || item.id}
                              value={preData?.id || item.id}
                              id={name}
                              onSelect={(currentValue) => {
                                field.onChange(
                                  currentValue === field.value
                                    ? ""
                                    : currentValue,
                                );
                                setOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  field.value === item.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {item.name || ""}
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
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
);

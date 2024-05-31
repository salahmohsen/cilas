import { useState, useEffect, useRef } from "react";

import { addDays, format } from "date-fns";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { TimePickerInput } from "@/components/ui/time-picker-input";
import MultipleSelector from "@/components/ui/multipleSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectContent,
  Select,
} from "@/components/ui/select";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  LoaderCircle,
} from "lucide-react";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { z } from "zod";
import { toast } from "sonner";

const CCFinputPropsSchema = z.object({
  control: z.any(),
  name: z.string(),
  formLabel: z.string(),
  placeholder: z.string().optional(),
  className: z.string().optional(),
  emptyMsg: z.string().optional(),
  options: z
    .union([
      z.array(
        z.object({
          label: z.string(),
          value: z.string(),
          disable: z.boolean().optional(),
        }),
      ),
      z.array(z.union([z.string(), z.number()])),
    ])
    .optional(),
  onchange: z.function().optional(),
});

type propTypes = z.infer<typeof CCFinputPropsSchema>;

export const CCFtextInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
}) => {
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formLabel}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={placeholder}
                value={field.value ? field.value : ""}
                onChange={field.onChange}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export const CCFtextAreaInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              onBlur={field.onBlur}
              className="min-h-[9.5rem]"
              id="content"
              placeholder={placeholder}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const CCFFileInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
  onchange,
}) => {
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formLabel}</FormLabel>
            <FormControl>
              <Input id="image" type="file" {...field} onBlur={field.onBlur} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export const CCFSelectInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  options,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Select
              onValueChange={(selectedOption) =>
                field.onChange(selectedOption.toLowerCase())
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options?.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/// Data Types ///

const CCFcomboBoxInputPropsSchema = CCFinputPropsSchema.merge(
  z.object({
    commandEmptyMsg: z.string(),
    action: z.function().optional(),
    searchPlaceholder: z.string(),
  }),
);

type comboBoxType = z.infer<typeof CCFcomboBoxInputPropsSchema>;

interface FetchData {
  value: string;
  label: string;
}

export const CCFcomboBoxInput: React.FC<comboBoxType> = ({
  control,
  name,
  formLabel,
  placeholder = "",
  searchPlaceholder = "",
  className,
  options,
  action,
  commandEmptyMsg,
}) => {
  const [data, setData] = useState<FetchData[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchData = async () => {
      if (open) {
        try {
          setLoading(true);
          const fetchDataResult: unknown = await action?.();
          if (fetchDataResult !== undefined) {
            const fetchData: FetchData = fetchDataResult as FetchData;
            setLoading(false);
            setData(fetchData);
          }
        } catch (error) {
          toast.error(`Failed to fetch ${formLabel} data`);
          setData([]);
        }
      }
    };
    fetchData();
  }, [action, formLabel, open]);

  return (
    <>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formLabel}</FormLabel>
            <FormControl>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                  >
                    {field.value
                      ? data?.find((item) => item?.value === field.value)
                          ?.label || ""
                      : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
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
                      <CommandEmpty>{commandEmptyMsg}</CommandEmpty>
                      <CommandGroup>
                        {data?.map((item) => (
                          <CommandItem
                            keywords={[item?.label]}
                            key={item.value}
                            value={item.value}
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
                                field.value === item.value
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {item.label || ""}
                          </CommandItem>
                        ))}
                        {loading && (
                          <CommandItem className=" grid animate-spin  place-items-center">
                            <LoaderCircle />
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

export const CCFDateInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={`w-full justify-start text-left font-normal ${!field.value ? "text-muted-foreground" : ""}`}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />

                  {field.value ? (
                    format(field.value, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.value}
                  onSelect={field.onChange}
                  className="rounded-md border"
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

interface TimeInputRefs {
  hourRef?: React.RefObject<HTMLInputElement>;
  minuteRef?: React.RefObject<HTMLInputElement>;
  transitionRef?: React.RefObject<HTMLInputElement>;
}
type timeInputTypeZod = z.infer<typeof CCFinputPropsSchema>;
type timeType = timeInputTypeZod & TimeInputRefs;

export const CCFtimeSInput: React.FC<timeType> = ({
  control,
  name,
  formLabel,
  className,
  hourRef,
  minuteRef,
  transitionRef,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel className="mt-6">{formLabel}</FormLabel>
          <FormControl>
            <div className="flex items-end gap-2">
              <div className="grid gap-1 text-center">
                <Label htmlFor="hours" className="text-xs">
                  Hours
                </Label>
                <TimePickerInput
                  picker="hours"
                  name="startHour"
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                  ref={hourRef}
                  onRightFocus={() => minuteRef?.current?.focus()}
                  onLeftFocus={() => transitionRef?.current?.focus()}
                />
              </div>
              <div className="grid gap-1 text-center">
                <Label htmlFor="minutes" className="text-xs">
                  Minutes
                </Label>
                <TimePickerInput
                  picker="minutes"
                  id="minutes"
                  name="startMinute"
                  date={field.value}
                  setDate={(date) => field.onChange(date)}
                  ref={minuteRef}
                  onRightFocus={() => transitionRef?.current?.focus()}
                  onLeftFocus={() => hourRef?.current?.focus()}
                />
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const CCFmultiSelectorInput: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  options,
  emptyMsg,
  className,
}) => {
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formLabel}</FormLabel>
            <FormControl>
              <MultipleSelector
                {...field}
                defaultOptions={options}
                placeholder={placeholder}
                emptyIndicator={
                  <p className=" text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                    {emptyMsg}
                  </p>
                }
                badgeClassName={
                  "py-1 mx-1 text-zinc-800 bg-gray-100 hover:bg-gray-300 rounded-sm"
                }
                hidePlaceholderWhenSelected={true}
                selected={field.value}
                setSelected={(values: any[]) => field.onChange(values)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export const CCFdateRange: React.FC<propTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
}) => {
  return (
    <div className={className}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{formLabel}</FormLabel>
            <Popover modal={true}>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !field.value.from && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.value.from ? (
                    field.value.to ? (
                      <>
                        {format(field.value.from, "LLL dd, y")} -{" "}
                        {format(field.value.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(field.value.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={field.value.from}
                  selected={{
                    from: field.value.from!,
                    to: field.value.to,
                  }}
                  onSelect={field.onChange}
                  numberOfMonths={1}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

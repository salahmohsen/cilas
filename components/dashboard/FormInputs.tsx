import { useState, useEffect } from "react";

import { getUserById } from "@/actions/usersActions";

import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import sanitizeHtml from "sanitize-html";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { TimePickerInput } from "@/components/ui/time-picker-input";
import MultipleSelector from "@/components/ui/multipleSelector";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
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

import TipTap from "../ui/TipTap";

import { toast } from "sonner";

import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  LoaderCircle,
} from "lucide-react";



const CommonInputPropsSchema = z.object({
  control: z.any(),
  name: z.string(),
  formLabel: z.string().optional(),
  placeholder: z.string().optional(),
  className: z.string().optional(),
  emptyMsg: z.string().optional(),
  onchange: z.function().optional(),
});

type commonPropTypes = z.infer<typeof CommonInputPropsSchema>;

export const TextInput: React.FC<commonPropTypes> = ({
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
        <FormItem className={className}>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Input
              
              placeholder={placeholder}
              value={field.value ? field.value : ""}
              onChange={field.onChange}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const TextAreaInput: React.FC<commonPropTypes> = ({
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
        <FormItem className={className}>
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

export const FileInput: React.FC<commonPropTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
  
}) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    // Reset the file URL when the component unmounts
    return () => setFileUrl(null);
  }, []);


  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Input type="file" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setFileUrl(URL.createObjectURL(file));
                  field.onChange(file);
                } else {
                  setFileUrl(null);
                  field.onChange(null);
                }
              }}
  />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

const SelectPropsSchema = CommonInputPropsSchema.merge(
  z.object({
    selects: z
      .array(
        z.object({
          groupLabel: z.string().optional(),
          selectItems: z.array(z.string()),
        }),
      )
      .optional(),
  }),
);

type selectType = z.infer<typeof SelectPropsSchema>;

export const SelectInput: React.FC<selectType> = ({
  control,
  name,
  formLabel,
  placeholder,
  selects,
  className,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <Select
              onValueChange={(selectedOption) =>
                field.onChange(selectedOption.toLowerCase())
              }
              defaultValue={field.value}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.value || placeholder} />
              </SelectTrigger>
              <SelectContent>
                {selects?.map((selectOption) => {
                  if (selectOption.groupLabel) {
                    return (
                      <SelectGroup key={selectOption.groupLabel}>
                        <SelectLabel>{selectOption.groupLabel}</SelectLabel>
                        {selectOption.selectItems.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    );
                  } else {
                    return selectOption.selectItems.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ));
                  }
                })}
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

const ComboBoxInputPropsSchema = CommonInputPropsSchema.merge(
  z.object({
    commandEmptyMsg: z.string(),
    action: z.function().optional(),
    searchPlaceholder: z.string(),
    isEditForm: z.boolean(),
    preValue: z.union([z.string(), z.number()]).optional(),
  }),
);

type comboBoxType = z.infer<typeof ComboBoxInputPropsSchema>;

interface FetchData {
  id: number;
  name: string;
}

export const ComboBoxInput: React.FC<comboBoxType> = ({
  control,
  name,
  formLabel,
  placeholder = "",
  searchPlaceholder = "",
  className,
  action,
  commandEmptyMsg,
  isEditForm,
  preValue
}) => {
  const [data, setData] = useState<FetchData[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
/* This useEffect used to fetch specific user in Edit Mode */
useEffect(() => {
  if(isEditForm && preValue) getUserById(Number(preValue)).then((res) => {
    setData([{id:res.id, name: `${res.firstName} ${res.lastName}`}])
    
  })
},[isEditForm, preValue])


  useEffect(() => {
    const fetchData = async () => {
      if (open) {
        try {
          setLoading(true);
          const result: any = await action?.();
          if (result !== undefined) {
            setLoading(false);
            setData(result);
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
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
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
                    ? data?.find((item) => item?.id === Number(field.value))
                        ?.name || ""
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
                          keywords={[item?.name]}
                          key={item.id}
                          value={String(item.id)}
                          onSelect={(currentValue) => {
                            field.onChange(
                              currentValue === field.value ? "" : currentValue,
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
                        <CommandItem className="grid animate-spin place-items-center">
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
  );
};

export const DateInput: React.FC<commonPropTypes> = ({
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
        <FormItem className={className}>
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
type timeType = z.infer<typeof CommonInputPropsSchema> & TimeInputRefs;

export const TimeInput: React.FC<timeType> = ({
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

const MultiSelectorProps = CommonInputPropsSchema.merge(
  z.object({
    options: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
          disable: z.boolean().optional(),
        }),
      )
      .optional(),
  }),
);

type MultiSelectorType = z.infer<typeof MultiSelectorProps>;

export const MultiSelectorInput: React.FC<MultiSelectorType> = ({
  control,
  name,
  formLabel,
  placeholder,
  options,
  emptyMsg,
  className,
}) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{formLabel}</FormLabel>
          <FormControl>
            <MultipleSelector
              {...field}
              defaultOptions={options}
              placeholder={placeholder}
              emptyIndicator={
                <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                  {emptyMsg}
                </p>
              }
              badgeClassName={
                "py-1 mx-1 text-zinc-800 bg-gray-100 hover:bg-gray-300 rounded-sm"
              }
              hidePlaceholderWhenSelected={true}
              value={field.value}
              onChange={(value) => field.onChange(value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const DateRangeInput: React.FC<commonPropTypes> = ({
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
        <FormItem className={className}>
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
  );
};

export const TipTapInput: React.FC<commonPropTypes> = ({
  control,
  name,
  formLabel,
  placeholder,
  className,
}) => {
  const clean = (dirty: string) => {
    const options = {
      allowedTags: [
        "p",
        "h4",
        "hr",
        "li",
        "ol",
        "ul",
        "em",
        "i",
        "strong",
        "blockquote",
        "s",
        "a",
        "br",
        "iframe",
      ],
      // Transform 'a' tags to add target and rel attributes
      transformTags: {
        a: sanitizeHtml.simpleTransform("a", {
          target: "_blank",
          rel: "noopener noreferrer",
        }),
      },
      // Define allowed attributes
      allowedAttributes: {
        a: ["href", "target", "rel"],
        p: ["dir"],
        h4: ["dir"],
        iframe: [
          "src",
          "width",
          "height",
          "allowfullscreen",
          "autoplay",
          "cclanguage",
          "disablekbcontrols",
          "enableiframeapi",
          "endtime",
          "ivloadpolicy",
          "loop",
          "modestbranding",
          "start",
        ],
      },
      // Define allowed iframe hostnames
      allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    };

    return sanitizeHtml(dirty, options);
  };

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{formLabel}</FormLabel>

          <FormControl>
            <TipTap
            key={field.value}
              description={field.value}
              onChange={(change) => field.onChange(clean(change))}
              placeholder={placeholder}
              
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

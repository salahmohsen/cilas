import { useState } from "react";
import { useCourseState } from "@/providers/CourseState.provider";
import { CoursesFilter } from "@/types/drizzle.types";
import { useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Filter } from "lucide-react";

const coursesFilter = [
  {
    value: "ongoing",
    label: "Ongoing",
  },
  {
    value: "archived",
    label: "Archived",
  },
  {
    value: "starting soon",
    label: "Starting soon",
  },
];

export default function FilterButton() {
  const { setCourseFilter } = useCourseState();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex w-[160px] justify-between"
        >
          <Filter className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          {value
            ? coursesFilter.find((filter) => filter.value === value)?.label
            : "Filter Courses..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search filters..." className="h-9" />
          <CommandList>
            <CommandEmpty>No filter found.</CommandEmpty>
            <CommandGroup>
              {coursesFilter.map((filter) => (
                <CommandItem
                  key={filter.value}
                  value={filter.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                    setCourseFilter(
                      currentValue === value
                        ? "all published"
                        : (currentValue as CoursesFilter),
                    );
                  }}
                >
                  {filter.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === filter.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

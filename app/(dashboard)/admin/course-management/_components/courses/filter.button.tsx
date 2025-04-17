import { useState } from "react";

import { Button } from "@/components/hoc/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils/utils";

import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter } from "@/lib/types/course.slice.types";
import { Blend, Check } from "lucide-react";

const coursesFilter = [
  {
    value: CoursesFilter.AllPublished,
    label: "Default",
  },
  {
    value: CoursesFilter.Ongoing,
    label: CoursesFilter.Ongoing,
  },
  {
    value: CoursesFilter.Archived,
    label: CoursesFilter.Archived,
  },
  {
    value: CoursesFilter.StartingSoon,
    label: CoursesFilter.StartingSoon,
  },
];

export function FilterButton() {
  const { setFilter } = useCourseStore();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<CoursesFilter | undefined>(
    CoursesFilter.AllPublished,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex justify-between gap-2"
          icon={<Blend />}
        >
          <span>View Preferences:</span>
          {value ? coursesFilter.find((filter) => filter.value === value)?.label : ""}
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
                    setValue(
                      currentValue === value
                        ? CoursesFilter.AllPublished
                        : (currentValue as CoursesFilter),
                    );
                    setOpen(false);
                    setFilter(
                      currentValue === value
                        ? CoursesFilter.AllPublished
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

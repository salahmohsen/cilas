import { useState } from "react";
import { useCourseState } from "@/providers/CourseState.provider";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, Filter } from "lucide-react";
import { CoursesFilter } from "@/types/manage.courses.types";

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

export function FilterButton() {
  const { setFilter } = useCourseState();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="flex justify-between gap-2">
          <Filter className="h-4 w-4 shrink-0 opacity-50" />
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
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                    setFilter(currentValue === value ? "published" : (currentValue as CoursesFilter));
                  }}
                >
                  {filter.label}
                  <Check className={cn("ml-auto h-4 w-4", value === filter.value ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

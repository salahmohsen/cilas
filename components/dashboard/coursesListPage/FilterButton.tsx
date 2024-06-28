import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuRadioItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCourseState } from "@/providers/CourseState.provider";
import { CoursesFilter } from "@/types/drizzle.types";
import { ListFilter } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function FilterButton() {
  const [position, setPosition] = useState<CoursesFilter>("all published");
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  const storedFilter = searchParams.get("publishedFilter") as CoursesFilter;

  const { setCourseFilter } = useCourseState();
  return (
    <div className="ml-auto">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1 text-sm">
            <ListFilter className="h-3.5 w-3.5" />
            <span className="sr-only sm:not-sr-only">Filter</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Filter by</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={storedFilter || position}
            onValueChange={(value) => {
              setPosition(value as CoursesFilter);
              setCourseFilter(value as CoursesFilter);
              params.set("publishedFilter", value); // This will save the filter in the url while shifting to draft courses
              window.history.pushState(null, "", `?${params.toString()}`);
            }}
          >
            <DropdownMenuRadioItem value="all published">
              <span>All</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ongoing">
              Ongoing
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="archived">
              Archived
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="starting soon">
              Starting Soon
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

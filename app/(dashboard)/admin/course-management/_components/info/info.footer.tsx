import { Button } from "@/components/hoc/button";
import { CardFooter } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useItemsNavContext } from "../../../../_lib/items.nav.context";

export const InfoFooter = ({ className }: { className?: string }) => {
  const { courseInfo } = useCourseStore();

  const { handleNext, handlePrev } = useItemsNavContext();

  return (
    <CardFooter
      className={cn(
        "flex w-full flex-row items-center border-t px-6 py-3 backdrop-blur-md",
        className,
      )}
    >
      <div className="text-muted-foreground text-xs">
        Updated{" "}
        <time dateTime="2023-11-23">
          {courseInfo && format(courseInfo.updatedAt, "dd MMMM yyyy")}
        </time>
      </div>
      <Pagination className="mr-0 ml-auto w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              size="icon"
              icon={<ChevronLeft />}
              variant="outline"
              className="h-8 w-8 lg:h-6 lg:w-6"
              onClick={handlePrev}
            >
              <span className="sr-only">Previous Order</span>
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              size="icon"
              icon={<ChevronRight />}
              variant="outline"
              className="h-8 w-8 lg:h-6 lg:w-6"
              onClick={handleNext}
            >
              <span className="sr-only">Next Order</span>
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </CardFooter>
  );
};

import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

import { useCourseStore } from "@/lib/store/course.slice";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useContext } from "react";
import { courseNavContext } from "../main.manage.courses";

export const InfoFooter = ({ className }: { className?: string }) => {
  const { courseInfo } = useCourseStore();

  const { handleNext, handlePrev } = useContext(courseNavContext);

  return (
    <CardFooter
      className={cn(
        "flex w-full flex-row items-center border-t px-6 py-3 backdrop-blur-md",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        Updated{" "}
        <time dateTime="2023-11-23">
          {courseInfo && format(courseInfo.updatedAt, "dd MMMM yyyy")}
        </time>
      </div>
      <Pagination className="ml-auto mr-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 lg:h-6 lg:w-6"
              onClick={handlePrev}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span className="sr-only">Previous Order</span>
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8 lg:h-6 lg:w-6"
              onClick={handleNext}
            >
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="sr-only">Next Order</span>
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </CardFooter>
  );
};

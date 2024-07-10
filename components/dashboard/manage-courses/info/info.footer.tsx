import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { useCourseState } from "@/providers/CourseState.provider";
import { CourseWithSafeFellow } from "@/types/drizzle.types";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const InfoFooter = ({ className }: { className?: string }) => {
  const { setIsCourseSelected, courseInfo, setCourseInfo, optimisticCourses } = useCourseState();

  if (!courseInfo) return;

  const idArr: number[] | undefined = optimisticCourses?.map((item) => item.id);
  const currentId = courseInfo.id;
  const currIndex = idArr?.indexOf(currentId);

  const handleNext = () => {
    if (idArr && typeof currIndex === "number" && currIndex < idArr.length - 1) {
      const nextId = idArr[currIndex + 1];
      setIsCourseSelected({ [nextId]: true });
      setCourseInfo(optimisticCourses?.find((item) => item?.id === nextId) as CourseWithSafeFellow);
    } else {
      if (idArr) setIsCourseSelected({ [idArr[0]]: true });
      if (optimisticCourses) setCourseInfo(optimisticCourses[0]);
    }
  };

  const handlePrev = () => {
    if (idArr && typeof currIndex === "number" && currIndex > 0) {
      const prevId = idArr[currIndex - 1];
      setIsCourseSelected({ [prevId]: true });
      setCourseInfo(optimisticCourses?.find((item) => item?.id === prevId) as CourseWithSafeFellow);
    } else {
      setIsCourseSelected({ [idArr?.at(-1) as number]: true });
      setCourseInfo(optimisticCourses?.at(-1) as CourseWithSafeFellow);
    }
  };
  return (
    <CardFooter
      className={cn(
        "flex w-full flex-row items-center border-t px-6 py-3 backdrop-blur-md",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        Updated <time dateTime="2023-11-23">{format(courseInfo.updatedAt, "dd MMMM yyyy")}</time>
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

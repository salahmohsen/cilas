import { useCourseState } from "@/providers/CourseState.provider";
import { differenceInWeeks, format } from "date-fns";
import { cn, getSeason } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { PegonsAvatar } from "./PegonAvatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { CourseWithAuthor } from "@/types/drizzle.types";
import { useWindowSize } from "@uidotdev/usehooks";

export default function CourseInfo({ className }: { className?: string }) {
  const { course, isSelected, setIsSelected, setCourse, courses } =
    useCourseState();

  const { width } = useWindowSize();
  if (!course) return;

  const idArr: number[] = courses.map((item) => item.id);
  const currentId = course?.id;
  const currIndex = idArr.indexOf(currentId);

  const handleNext = () => {
    if (currIndex < idArr.length - 1) {
      const nextId = idArr[currIndex + 1];
      setIsSelected({ [nextId]: true });
      setCourse(
        courses.find((item) => item?.id === nextId) as CourseWithAuthor,
      );
    } else {
      setIsSelected({ [idArr[0]]: true });
      setCourse(courses[0]);
    }
  };

  const handlePrev = () => {
    if (currIndex > 0) {
      const prevId = idArr[currIndex - 1];
      setIsSelected({ [prevId]: true });
      setCourse(
        courses.find((item) => item?.id === prevId) as CourseWithAuthor,
      );
    } else {
      setIsSelected({ [idArr.at(-1) as number]: true });
      setCourse(courses.at(-1) as CourseWithAuthor);
    }
  };
  return (
    <Card
      className={cn(
        `flex flex-col justify-between`,
        width && width < 1024
          ? "w-full transition-none"
          : Object.values(isSelected)[0]
            ? "ml-5 w-[30%] opacity-100"
            : "w-0 opacity-0",
        className,
      )}
    >
      <ScrollArea className="overflow-y-auto" type="hover">
        <CardHeader className="flex flex-row items-start bg-muted/50">
          <div className="grid gap-0.5">
            <CardTitle className="group flex items-center gap-2 text-lg">
              <span className="" dir={course.enTitle ? "ltr" : "rtl"}>
                {course?.enTitle || course?.arTitle}
              </span>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Copy className="h-3 w-3" />
                <span className="sr-only">Copy Course Name</span>
              </Button>
            </CardTitle>
            <CardDescription>
              Date: {format(course.dateRange.from, "dd MMMM yyyy")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-6 text-sm">
          <div className="grid gap-3">
            <div className="font-semibold">Course Details</div>
            <ul className="grid gap-3">
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Category</span>
                <span>{course.category}</span>
              </li>
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Season Cycle</span>
                <span>{getSeason(course?.dateRange.from)}</span>
              </li>
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Registration</span>
                <span>{course?.isRegistrationOpen ? "Open" : "Closed"}</span>
              </li>
            </ul>
            <Separator className="my-2" />
            <ul className="grid gap-3">
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Start Date</span>
                <span>{format(course?.dateRange.from, "dd MMMM yyyy")}</span>
              </li>
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">End Date</span>
                <span>{format(course?.dateRange.to, "dd MMMM yyyy")}</span>
              </li>
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Duration</span>
                <span>
                  {differenceInWeeks(
                    course?.dateRange.to,
                    course?.dateRange.from,
                  )}{" "}
                  Weeks
                </span>
              </li>
              <li className="flex items-center justify-between gap-5">
                <span className="text-muted-foreground">Days</span>
                <span>
                  {course.days?.length === 0
                    ? "-"
                    : "Every " +
                      course.days?.map((day, index) =>
                        course.days?.length === index + 1
                          ? ` and ${day.label}`
                          : `${day.label}`,
                      )}
                </span>
              </li>
            </ul>
          </div>
          <Separator className="my-4" />
          <div className="grid gap-3">
            <div className="font-semibold">Facilitator Information</div>
            <dl className="grid gap-3">
              <div className="flex items-center justify-between gap-5">
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  {course.author?.firstName + " " + course.author?.lastName}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-5">
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <a href="mailto:">{course.author?.email}</a>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-5">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>
                  <a href="tel:">{course.author?.tel}</a>
                </dd>
              </div>
            </dl>
          </div>

          <Separator className="my-4" />
          <div className="grid auto-rows-max gap-3">
            {/* //TODO -> Adding students */}
            <div className="font-semibold">Pegons</div>
            <ScrollArea className="w-full rounded-md p-4">
              <div className="flex gap-1 text-muted-foreground">
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
                <PegonsAvatar />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </CardContent>
      </ScrollArea>
      <CardFooter className="flex w-full flex-row items-center border-t bg-muted/50 px-6 py-3">
        <div className="text-xs text-muted-foreground">
          Updated{" "}
          <time dateTime="2023-11-23">
            {format(course.updatedAt, "dd MMMM yyyy")}
          </time>
        </div>
        <Pagination className="ml-auto mr-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button
                size="icon"
                variant="outline"
                className="h-6 w-6"
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
                className="h-6 w-6"
                onClick={handleNext}
              >
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="sr-only">Next Order</span>
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </CardFooter>
    </Card>
  );
}

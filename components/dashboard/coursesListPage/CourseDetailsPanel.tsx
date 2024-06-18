import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination";

import { Button } from "../../ui/button";

import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  MoreVertical,
  Truck,
} from "lucide-react";
import { Separator } from "../../ui/separator";
import PegonsAvatar from "./PegonAvatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn, getSeason } from "@/lib/utils";
import { courseSchema } from "@/types/courseForm.schema";
import { z } from "zod";
import { differenceInWeeks, format } from "date-fns";
import { InferSelectModel } from "drizzle-orm";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CourseDetailsPanel({
  className,
  data,
}: {
  className?: string;
  data: z.infer<typeof courseSchema>;
}) {
  const { course, user } = data;
  return (
    <Card className={cn("overflow-y-auto overflow-x-hidden", className)}>
      <CardHeader className="flex flex-row items-start bg-muted/50">
        <div className="grid gap-0.5">
          <CardTitle className="group flex items-center gap-2 text-lg">
            {course.enTitle || course.arTitle}
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
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Category</span>
              <span>{course.category}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Season Cycle</span>
              <span>{getSeason(course.dateRange.from)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Registration</span>
              <span>{course.isRegistrationOpen ? "Open" : "Closed"}</span>
            </li>
          </ul>
          <Separator className="my-2" />
          <ul className="grid gap-3">
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Start Date</span>
              <span>{format(course.dateRange.from, "dd MMMM yyyy")}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">End Date</span>
              <span>{format(course.dateRange.to, "dd MMMM yyyy")}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Duration</span>
              <span>
                {differenceInWeeks(course.dateRange.to, course.dateRange.from)}{" "}
                Weeks
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-muted-foreground">Days</span>
              <span>
                {course.days.length === 0
                  ? "-"
                  : "Every" + course.days.join(" - ")}
              </span>
            </li>
          </ul>
        </div>
        <Separator className="my-4" />
        <div className="grid gap-3">
          <div className="font-semibold">Facilitator Information</div>
          <dl className="grid gap-3">
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.firstName + " " + user.lastName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                <a href="mailto:">{user.email}</a>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                <a href="tel:">{user.tel}</a>
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
      <CardFooter className="flex flex-row items-center border-t bg-muted/50 px-6 py-3">
        <div className="text-xs text-muted-foreground">
          Updated{" "}
          <time dateTime="2023-11-23">
            {format(course.updatedAt, "dd MMMM yyyy")}
          </time>
        </div>
        <Pagination className="ml-auto mr-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <Button size="icon" variant="outline" className="h-6 w-6">
                <ChevronLeft className="h-3.5 w-3.5" />
                <span className="sr-only">Previous Order</span>
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button size="icon" variant="outline" className="h-6 w-6">
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

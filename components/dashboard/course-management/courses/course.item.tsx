"use client";

import { useCourseState } from "@/lib/providers/CourseState.provider";
import { forwardRef, useState } from "react";

import { format } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ConfirmationDialog } from "@/components/shared/confirmation.dialog";
import { CourseWithSafeFellow } from "@/lib/types/drizzle.types";
import { Calendar, Ellipsis, User } from "lucide-react";

type CourseItemProps = { course: CourseWithSafeFellow };

export const CourseItem = forwardRef<HTMLLIElement, CourseItemProps>(
  ({ course }, ref) => {
    const {
      state: { isCourseSelected },
      dispatch,
      handleDelete,
    } = useCourseState();
    const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] =
      useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleSelect = (id: number) => {
      dispatch({
        type: "SET_COURSE_SELECTED",
        payload: { [id]: !isCourseSelected?.[id] },
      });
      dispatch({
        type: "SET_COURSE_INFO",
        payload: isCourseSelected?.[id] ? null : course,
      });
    };

    const courseStatues = ():
      | "ongoing"
      | "starting soon"
      | "archived"
      | "draft"
      | "unknown status" => {
      const currentDate = new Date();
      const startDate = new Date(course.startDate);
      const endDate = new Date(course.endDate);
      const isDraft = course.draftMode;
      if (isDraft) return "draft";
      if (startDate <= currentDate && endDate >= currentDate && !isDraft)
        return "ongoing";
      if (startDate > currentDate && !isDraft) return "starting soon";
      if (endDate < currentDate && !isDraft) return "archived";

      return "unknown status";
    };

    return (
      <>
        <li
          className={`flex cursor-pointer items-center justify-between gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isCourseSelected?.[course.id] || isMenuOpen ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
          onClick={() => handleSelect(course.id)}
          data-course-id={course.id}
          ref={ref}
        >
          <div className="flex flex-col gap-4">
            <span className="flex gap-1 text-xs font-light">
              <User size={16} strokeWidth={1.5} />
              {`${course.fellow?.firstName} ${course.fellow?.lastName}`}
            </span>
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-2">
              <Badge
                variant="default"
                className="h-6 min-w-max max-w-max rounded-sm"
              >
                {courseStatues()}
              </Badge>
              <p className="line-clamp-3 leading-relaxed lg:line-clamp-1">
                {course.enTitle || course.arTitle}
              </p>
            </div>
            <span className="flex gap-1 text-xs font-light">
              <Calendar size={16} strokeWidth={1.5} />
              {format(course.startDate, "MMMM dd yyyy")}
            </span>
          </div>
          <div>
            <DropdownMenu onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className={`h-8 w-8 ${isCourseSelected ? "bg-background text-foreground" : ""}`}
                >
                  <Ellipsis className="h-3.5 w-3.5" />
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link
                  href={`/dashboard/course-management/edit-course?id=${course.id}`}
                >
                  <DropdownMenuItem
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                  >
                    Edit
                  </DropdownMenuItem>
                </Link>
                <Link
                  href={`/dashboard/course-management/create-course?duplicate-course=${course.id}`}
                >
                  <DropdownMenuItem
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                  >
                    Duplicate
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmationDialogOpen(true);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
        <ConfirmationDialog
          isOpen={isConfirmationDialogOpen}
          setIsOpen={setIsConfirmationDialogOpen}
          title={`Delete ${(course.enTitle || course.arTitle) ?? "Course"}`}
          onConfirm={() => handleDelete(course.id)}
        />
      </>
    );
  },
);

CourseItem.displayName = "CourseItem";

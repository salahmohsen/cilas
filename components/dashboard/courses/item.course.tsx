"use client";

import { useState } from "react";
import { useCourseState } from "@/providers/CourseState.provider";

import Link from "next/link";
import slug from "slug";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Calendar, Ellipsis, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CourseWithFellow } from "@/types/drizzle.types";

export function CourseItem({
  course,
  handleDelete,
}: {
  course: CourseWithFellow;
  handleDelete: (courseId: number) => void;
}) {
  const { isCourseSelected, setIsCourseSelected, setCourseInfo } =
    useCourseState();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelect = (id) => {
    setIsCourseSelected((prev) => ({
      [id]: prev[id] ? undefined : !prev[id],
    }));
    setCourseInfo(course);
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
    <li
      className={`flex cursor-pointer items-center justify-between gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isCourseSelected[course.id] || isMenuOpen ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
      onClick={() => handleSelect(course.id)}
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
              href={`/dashboard/manage-courses/edit-course/${slug(course.enTitle)}-${course.id}`}
            >
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Edit
              </DropdownMenuItem>
            </Link>
            <Link
              href={`/dashboard/manage-courses/create-course?copy_values=${course.id}`}
            >
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Duplicate
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onSelect={() => handleDelete(course.id)}
              onClick={(e) => e.stopPropagation()}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
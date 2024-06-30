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
import { CourseWithAuthor } from "@/types/drizzle.types";

export default function CourseItem({ course }: { course: CourseWithAuthor }) {
  const { isSelected, setIsSelected, setCourse, handleDelete } =
    useCourseState();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSelect = (id) => {
    setIsSelected((prev) => ({
      [id]: prev[id] === id ? undefined : !prev[id],
    }));
    setCourse(course);
  };
  const courseStatues = ():
    | "ongoing"
    | "starting soon"
    | "archived"
    | "draft"
    | "unknown status" => {
    const currentDate = new Date();
    const from = new Date(course.dateRange.from);
    const to = new Date(course.dateRange.to);
    const isDraft = course.draftMode;
    if (isDraft) return "draft";
    if (from <= currentDate && to >= currentDate && !isDraft) return "ongoing";
    if (from > currentDate && !isDraft) return "starting soon";
    if (to < currentDate && !isDraft) return "archived";

    return "unknown status";
  };

  return (
    <li
      className={`flex cursor-pointer items-center justify-between gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isSelected[course.id] || isMenuOpen ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
      onClick={() => handleSelect(course.id)}
    >
      <div className="flex flex-col gap-4">
        <span className="flex gap-1 text-xs font-light">
          <User size={16} strokeWidth={1.5} />
          {`${course.author?.firstName} ${course.author?.lastName}`}
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
          {format(course.dateRange.from, "MMMM dd yyyy")}
        </span>
      </div>
      <div>
        <DropdownMenu onOpenChange={setIsMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={`h-8 w-8 ${isSelected ? "bg-background text-foreground" : ""}`}
            >
              <Ellipsis className="h-3.5 w-3.5" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link
              href={`/dashboard/courses/edit-course/${slug(course.enTitle)}-${course.id}`}
            >
              <DropdownMenuItem>Edit</DropdownMenuItem>
            </Link>
            <Link
              href={`/dashboard/courses/create-course?duplicate=${course.id}`}
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

"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { deleteCourse } from "@/actions/courses.actions";
import { CourseType, useCourseState } from "@/providers/CourseState.provider";

import Link from "next/link";
import { toast } from "sonner";
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

export default function CourseItem({ item }: { item: CourseType }) {
  const { course, user } = item;

  const {
    isSelected: isSelected,
    setIsSelected: setIsSelected,
    setCourseInfo,
  } = useCourseState();

  const [formState, formAction] = useFormState(
    deleteCourse.bind(null, Number(course?.id)),
    {},
  );

  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  if (formState?.success) {
    toast.success(formState.success);
  }
  if (formState?.error) {
    toast.error(formState.error);
  }

  const handleSelect = (id) => {
    setIsSelected((prev) => ({ [id]: !prev[id] }));
    setCourseInfo(item);
  };

  return (
    <li
      className={`flex cursor-pointer items-center justify-between gap-2 rounded-md px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isSelected[course.id] ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
      onClick={() => handleSelect(course.id)}
    >
      <div className="flex flex-col gap-2">
        <span className="flex gap-1 text-xs font-light">
          <User size={16} strokeWidth={1.5} />
          {`${user?.firstName} ${user?.lastName}`}
        </span>
        <p>{course.enTitle || course.arTitle}</p>
        <span className="flex gap-1 text-xs font-light">
          <Calendar size={16} strokeWidth={1.5} />
          {format(course.dateRange.from, "MMMM dd yyyy")}
        </span>
      </div>
      <div>
        <DropdownMenu>
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
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={formAction}>
              <DropdownMenuItem
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onSelect={() => deleteButtonRef.current?.click()}
              >
                Delete
              </DropdownMenuItem>
              <button type="submit" hidden ref={deleteButtonRef} />
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

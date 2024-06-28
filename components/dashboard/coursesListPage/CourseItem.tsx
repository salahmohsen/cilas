"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import {
  DuplicateCourseState,
  deleteCourse,
  duplicateCourse,
} from "@/actions/courses.actions";
import { useCourseState } from "@/providers/CourseState.provider";

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
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DbCourse } from "@/types/drizzle.types";

export default function CourseItem({ item }: { item: DbCourse }) {
  const { course, user } = item;
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const duplicateButtonRef = useRef<HTMLButtonElement>(null);
  const { isSelected, setIsSelected, setCourseInfo } = useCourseState();

  const [deleteState, deleteAction] = useFormState(
    deleteCourse.bind(null, Number(course?.id)),
    {},
  );

  const [duplicateState, duplicateAction] = useFormState(
    duplicateCourse.bind(null, Number(course?.id)),
    {} as DuplicateCourseState,
  );

  useEffect(() => {
    if (deleteState?.success) toast.success(deleteState.success);
    if (deleteState?.error) toast.error(deleteState.error);
    if (duplicateState?.success) toast.success(duplicateState.success);
    if (duplicateState?.editLink) redirect(duplicateState.editLink);
    if (duplicateState?.error) toast.error(duplicateState.error);
  }, [deleteState, duplicateState]);
  const handleSelect = (id) => {
    setIsSelected((prev) => ({
      [id]: prev[id] === id ? undefined : !prev[id],
    }));
    setCourseInfo(item);
  };
  const courseStatues = ():
    | "ongoing"
    | "starting soon"
    | "archived"
    | "draft"
    | "unknown status" => {
    const currentDate = new Date();
    const from = new Date(item.course.dateRange.from);
    const to = new Date(item.course.dateRange.to);
    const isDraft = item.course.draftMode;
    if (isDraft) return "draft";
    if (from <= currentDate && to >= currentDate && !isDraft) return "ongoing";
    if (from > currentDate && !isDraft) return "starting soon";
    if (to < currentDate && !isDraft) return "archived";

    return "unknown status";
  };

  return (
    <li
      className={`flex cursor-pointer items-center justify-between gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isSelected[course.id] ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
      onClick={() => handleSelect(course.id)}
    >
      <div className="flex flex-col gap-4">
        <span className="flex gap-1 text-xs font-light">
          <User size={16} strokeWidth={1.5} />
          {`${user?.firstName} ${user?.lastName}`}
        </span>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-2">
          <Badge
            variant="default"
            className="h-5 min-w-max max-w-max rounded-sm"
          >
            {courseStatues()}
          </Badge>
          <p className="leading-relaxed">{course.enTitle || course.arTitle}</p>
        </div>
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
            <form action={duplicateAction}>
              <DropdownMenuItem
                onSelect={() => duplicateButtonRef.current?.click()}
              >
                Duplicate
              </DropdownMenuItem>
              <button type="submit" hidden ref={duplicateButtonRef} />
            </form>
            <DropdownMenuSeparator />
            <form action={deleteAction}>
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

"use client";

import { forwardRef, useState } from "react";

import { format } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ConfirmationDialog } from "@/components/ui/dialog-confirmation";
import { useCourseStore } from "@/lib/store/course.slice";
import { CourseWithFellow } from "@/lib/types/drizzle.types";
import { getCourseStatus } from "@/lib/utils";
import { Calendar, Ellipsis, User } from "lucide-react";
import { useRouter } from "next/navigation";

type CourseItemProps = { course: CourseWithFellow };

export const CourseItem = forwardRef<HTMLLIElement, CourseItemProps>(
  ({ course }, ref) => {
    const { handleDelete, setCourseSelected, setCourseInfo, isCourseSelected } =
      useCourseStore();

    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const handleSelect = (id: number) => {
      setCourseSelected({ [id]: !isCourseSelected?.[id] });
      setCourseInfo(isCourseSelected?.[id] ? null : course);
    };

    const router = useRouter();

    const courseTitle = course.enTitle || course.arTitle;
    const courseStatues = getCourseStatus(course);

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
            {courseStatues && (
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-2">
                <Badge
                  variant="default"
                  className="h-6 min-w-max max-w-max rounded-sm"
                  title={`${courseTitle} is ${courseStatues}`}
                >
                  {courseStatues}
                </Badge>
                <p className="line-clamp-3 leading-relaxed lg:line-clamp-1">
                  {courseTitle}
                </p>
              </div>
            )}
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
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.stopPropagation();
                    router.push(`/admin/course-management/edit-course?id=${course.id}`);
                  }}
                  className="cursor-pointer"
                >
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={(e) => {
                    e.stopPropagation();
                    router.push(
                      `/admin/course-management/create-course?duplicate-course=${course.id}`,
                    );
                  }}
                  className="cursor-pointer"
                >
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleteDialogVisible(true);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
        <ConfirmationDialog
          isOpen={isDeleteDialogVisible}
          setIsOpen={setIsDeleteDialogVisible}
          title={`Delete ${(course.enTitle || course.arTitle) ?? "Course"}`}
          onConfirm={() => handleDelete(course.id)}
        />
      </>
    );
  },
);

CourseItem.displayName = "CourseItem";

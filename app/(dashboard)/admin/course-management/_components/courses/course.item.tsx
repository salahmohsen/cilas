"use client";

import { forwardRef, useState } from "react";

import { format } from "date-fns";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { CoursesFilter } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { AvatarGroup } from "@/components/avatar";
import { Button } from "@/components/button";
import { ConfirmationDialog } from "@/components/ui/dialog-confirmation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  CircleDashed,
  Ellipsis,
  Hash,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { PrivateCourse } from "../../_lib/courses.actions.types";
import { getSeason, getSeasonIcon } from "../../_lib/courses.utils";
import { getCourseStatus } from "../../_lib/utils";
import { UpdateEnrollmentsDialog } from "./update.enrollments.dialog";

type CourseItemProps = { course: PrivateCourse };

export const CourseItem = forwardRef<HTMLLIElement, CourseItemProps>(
  ({ course }, ref) => {
    const { handleDelete, setSelectedCourse, setCourseInfo, selectedCourse } =
      useCourseStore();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
    const [isStudentDialogOpen, setIsStudentDialogOpen] = useState<boolean>(false);

    const handleSelect = (id: number) => {
      setSelectedCourse({ [id]: !selectedCourse?.[id] });
      setCourseInfo(selectedCourse?.[id] ? null : course);
    };

    const router = useRouter();

    const courseTitle = course.enTitle || course.arTitle;
    const courseStatues = getCourseStatus(course);

    const status =
      courseStatues === CoursesFilter.Ongoing ? (
        <PlayCircle strokeWidth={0.67} />
      ) : courseStatues === CoursesFilter.StartingSoon ? (
        <CircleDashed strokeWidth={0.67} />
      ) : (
        <StopCircle strokeWidth={0.67} />
      );

    const season = getSeason(course.startDate);
    const SeasonIcon = getSeasonIcon(season);

    return (
      <>
        <li
          className={`content-list-item flex`}
          data-selected={selectedCourse?.[course.id] || isMenuOpen}
          data-item-id={course.id}
          onClick={() => handleSelect(course.id)}
          ref={ref}
        >
          {courseStatues && <span className="hidden md:block"> {status}</span>}
          <div className="flex w-full justify-between">
            <div className="flex flex-1 flex-col gap-2">
              <p className="line-clamp-3 leading-relaxed lg:line-clamp-1">
                {courseTitle}
              </p>
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1 text-sm font-light">
                  <AvatarGroup
                    users={course.fellows}
                    className="h-8 w-8 cursor-default!"
                  />
                </span>
                <span className="flex items-center gap-1 text-sm font-light">
                  <Calendar size={16} strokeWidth={1.5} />
                  {format(course.startDate, "MMMM dd yyyy")}
                </span>

                <span className="hidden items-center gap-1 text-sm font-light md:flex">
                  <Hash size={16} strokeWidth={1.5} />
                  {course.category.enName}
                </span>
                <span className="hidden items-center gap-1 text-sm font-light md:flex">
                  {SeasonIcon}
                  {season}
                </span>
              </div>
            </div>
            <DropdownMenu onOpenChange={setIsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  icon={<Ellipsis />}
                  variant="outline"
                  className={"border-0"}
                >
                  <span className="sr-only">More</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    router.push(`/admin/course-management/edit/${course.slug}`)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                >
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() =>
                    router.push(
                      `/admin/course-management/create-course?duplicate=${course.slug}`,
                    )
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                >
                  Duplicate
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() => setIsStudentDialogOpen(true)}
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                >
                  Update enrollments
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
                  onSelect={() => setIsDeleteDialogVisible(true)}
                  onClick={(e) => e.stopPropagation()}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </li>
        <UpdateEnrollmentsDialog
          courseId={course.id}
          isOpen={isStudentDialogOpen}
          setIsOpen={setIsStudentDialogOpen}
          enrollments={course.enrollments}
        />
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

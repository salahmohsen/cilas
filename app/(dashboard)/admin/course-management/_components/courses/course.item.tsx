"use client";

import { forwardRef, useState } from "react";

import { format } from "date-fns";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { CoursesFilter } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/hoc/button";
import { ConfirmationDialog } from "@/components/ui/dialog-confirmation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { getCourseStatus } from "@/lib/utils";
import {
  Calendar,
  CircleDashed,
  Ellipsis,
  Hash,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getSeason, getSeasonIcon } from "../../_lib/courses.utils";
import { AddStudentsDialog } from "./add.students.dialog";

type CourseItemProps = { course: CourseWithFellowAndStudents };

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
                  <Calendar size={16} strokeWidth={1.5} />
                  {format(course.startDate, "MMMM dd yyyy")}
                </span>

                <span className="flex items-center gap-1 text-sm font-light">
                  <Avatar user={course.fellow} className="h-4 w-4" />
                  {`${course.fellow?.firstName} ${course.fellow?.lastName}`}
                </span>
                <span className="hidden items-center gap-1 text-sm font-light md:flex">
                  <Hash size={16} strokeWidth={1.5} />
                  {course.category}
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
                    router.push(`/admin/course-management/edit-course?id=${course.id}`)
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="cursor-pointer"
                >
                  Edit
                </DropdownMenuItem>

                <DropdownMenuItem
                  onSelect={() =>
                    router.push(
                      `/admin/course-management/create-course?duplicate-course=${course.id}`,
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
        <AddStudentsDialog
          courseId={course.id}
          isOpen={isStudentDialogOpen}
          setIsOpen={setIsStudentDialogOpen}
          courseStudents={course.students.map((student) => ({
            value: student.id,
            label: `${student.firstName} ${student.lastName}`,
          }))}
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

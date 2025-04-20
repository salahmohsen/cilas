"use client";

import { forwardRef, useState } from "react";

import { format } from "date-fns";

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
import { useCourseStore } from "@/lib/store/course.slice";
import { useUserStore } from "@/lib/store/user.slice";
import { CoursesFilter } from "@/lib/types/courses.slice.types";
import { CourseWithFellowAndStudents } from "@/lib/types/drizzle.types";
import { getCourseStatus } from "@/lib/utils";
import { Calendar, CircleDashed, Ellipsis, PlayCircle, StopCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { AddStudentsDialog } from "./add.students.dialog";

type CourseItemProps = { course: CourseWithFellowAndStudents };

export const CourseItem = forwardRef<HTMLLIElement, CourseItemProps>(
  ({ course }, ref) => {
    const { handleDelete, setCourseSelected, setCourseInfo, isCourseSelected } =
      useCourseStore();

    const { userInfo } = useUserStore();

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDeleteDialogVisible, setIsDeleteDialogVisible] = useState<boolean>(false);
    const [isStudentDialogOpen, setIsStudentDialogOpen] = useState<boolean>(false);

    const handleSelect = (id: number) => {
      setCourseSelected({ [id]: !isCourseSelected?.[id] });
      setCourseInfo(isCourseSelected?.[id] ? null : course);
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

    return (
      <>
        <li
          className={`lg:hover:bg-accent flex cursor-pointer items-center gap-4 rounded-md py-6 text-sm font-medium transition-all duration-300 hover:-mx-4 hover:px-5 lg:group-hover/list:opacity-50 lg:hover:opacity-100! ${isCourseSelected?.[course.id] || isMenuOpen ? "bg-accent -mx-4 px-5 opacity-100!" : "bg-transparent"}`}
          onClick={() => handleSelect(course.id)}
          data-course-id={course.id}
          ref={ref}
        >
          {courseStatues && <span> {status}</span>}
          <div className="flex w-full justify-between">
            <div className="flex flex-1 flex-col gap-4">
              <p className="line-clamp-3 leading-relaxed lg:line-clamp-1">
                {courseTitle}
              </p>
              <div className="flex items-center gap-5">
                <span className="flex gap-1 text-xs font-light">
                  <Calendar size={16} strokeWidth={1.5} />
                  {format(course.startDate, "MMMM dd yyyy")}
                </span>

                <span className="flex gap-1 text-xs font-light">
                  <Avatar user={course.fellow} className="h-4 w-4" />
                  {`${course.fellow?.firstName} ${course.fellow?.lastName}`}
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

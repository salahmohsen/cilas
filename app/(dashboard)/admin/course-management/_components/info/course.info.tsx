import { Button } from "@/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/utils";
import { differenceInWeeks, format } from "date-fns";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import { Separator } from "@/components/ui/separator";
import { TailwindBreakpoint } from "@/lib/types/geniric.enums";
import { useWindowSize } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { Copy } from "lucide-react";
import { forwardRef } from "react";
import { toast } from "sonner";
import { InfoFooter } from "../../../_components/info.footer";
import { UserSettingDialog } from "../../../_components/users/user.setting.dialog";
import { getSeason } from "../../_lib/courses.utils";

type CourseInfoProps = {
  className?: string;
  mode: "dialog" | "flex";
};

export const CourseInfo = forwardRef<HTMLDivElement, CourseInfoProps>(
  ({ className, mode }, ref) => {
    const { courseInfo, selectedCourse } = useCourseStore();
    const { width } = useWindowSize();
    const showCourseInfo = Object.values(selectedCourse ?? false)[0] ?? false;

    return (
      <AnimatePresence>
        {showCourseInfo && courseInfo && (
          <motion.div
            className={cn(`flex w-full flex-col justify-between`, className)}
            initial={mode === "flex" && { x: "50vw", width: 0 }}
            animate={mode === "flex" && { x: 0, width: "50%" }}
            exit={mode === "flex" ? { x: "50vw", width: 0 } : undefined}
            ref={ref}
          >
            <Card
              className={cn("overflow-y-auto", mode === "dialog" && "h-full border-0")}
            >
              <ScrollArea
                type="hover"
                className={cn(mode === "flex" ? "h-[calc(100%-60px)]" : "h-full")}
              >
                <Header course={courseInfo} />

                <CardContent className="p-6 text-sm">
                  <CourseDetails course={courseInfo} />
                  <Separator className="my-4" />
                  <FacilitatorInfo course={courseInfo} />
                  <Separator className="my-4" />
                  <StudentsSection course={courseInfo} />
                </CardContent>
              </ScrollArea>
              {width && courseInfo.updatedAt && width >= TailwindBreakpoint.LG && (
                <InfoFooter updatedAt={courseInfo.updatedAt} />
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

const Header = ({ course }) => {
  return (
    <CardHeader className="bg-accent flex flex-row items-start">
      <div className="grid gap-0.5">
        <CardTitle className="group flex items-center gap-2 text-lg">
          <span dir={course.enTitle ? "ltr" : "rtl"}>
            {course.enTitle || course.arTitle}
          </span>
          <Button
            size="icon"
            variant="outline"
            icon={<Copy className="p-0.5" />}
            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => {
              navigator.clipboard
                .writeText((course.enTitle || course.arTitle) as string)
                .then(() => {
                  toast.success("Copied!");
                });
            }}
          >
            <span className="sr-only">Copy Course Name</span>
          </Button>
        </CardTitle>
        <CardDescription>
          Date: {format(course.startDate, "dd MMMM yyyy")}
        </CardDescription>
      </div>
    </CardHeader>
  );
};

const CourseDetails = ({ course }) => {
  return (
    <div className="grid gap-3">
      <div className="font-semibold">Course Details</div>
      <CourseCategory course={course} />
      <Separator className="my-2" />
      <CourseDuration course={course} />
    </div>
  );
};

const CourseCategory = ({ course }) => {
  return (
    <ul className="grid gap-3">
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Category</span>
        <span>{course.category}</span>
      </li>
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Season Cycle</span>
        <span>{getSeason(course.startDate)}</span>
      </li>
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Registration</span>
        <span>{course.isRegistrationOpen ? "Open" : "Closed"}</span>
      </li>
    </ul>
  );
};

const CourseDuration = ({ course }) => {
  return (
    <ul className="grid gap-3">
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Start Date</span>
        <span>{format(course.startDate, "dd MMMM yyyy")}</span>
      </li>
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">End Date</span>
        <span>{format(course.endDate, "dd MMMM yyyy")}</span>
      </li>
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Duration</span>
        <span>{differenceInWeeks(course.endDate, course.startDate)} Weeks</span>
      </li>
      <li className="flex items-center justify-between gap-5">
        <span className="text-muted-foreground">Days</span>
        <span className="text-right">
          {course.days?.length === 0
            ? "-"
            : "Every " +
              course.days?.map((day, index) =>
                course.days?.length === index + 1 ? ` and ${day.label}` : ` ${day.label}`,
              )}
        </span>
      </li>
    </ul>
  );
};

const FacilitatorInfo = ({ course }) => {
  return (
    <div className="grid gap-3">
      <div className="font-semibold">Facilitator Information</div>
      <dl className="grid gap-3">
        <div className="flex items-center justify-between gap-5">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{course.fellow?.firstName + " " + course.fellow?.lastName}</dd>
        </div>
        <div className="flex items-center justify-between gap-5">
          <dt className="text-muted-foreground">Email</dt>
          <dd>
            <a href="mailto:">{course.fellow?.email}</a>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-5">
          <dt className="text-muted-foreground">Phone</dt>
          <dd>
            <a href="tel:">{course.fellow?.tel}</a>
          </dd>
        </div>
      </dl>
    </div>
  );
};

const StudentsSection = ({ course }) => {
  return (
    <div className="grid auto-rows-max gap-3">
      <div className="font-semibold">Students</div>
      <ScrollArea className="w-full">
        {course.students && (
          <UserSettingDialog users={course.students} courseId={course.id} />
        )}
        {!course.students?.length && <p>No students found</p>}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
};

CourseInfo.displayName = "CourseInfo";

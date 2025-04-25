import { Button } from "@/components/hoc/button";
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
                <CardHeader className="bg-accent flex flex-row items-start">
                  <div className="grid gap-0.5">
                    <CardTitle className="group flex items-center gap-2 text-lg">
                      <span dir={courseInfo.enTitle ? "ltr" : "rtl"}>
                        {courseInfo.enTitle || courseInfo.arTitle}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        icon={<Copy className="p-0.5" />}
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(
                              (courseInfo.enTitle || courseInfo.arTitle) as string,
                            )
                            .then(() => {
                              toast.success("Copied!");
                            });
                        }}
                      >
                        <span className="sr-only">Copy Course Name</span>
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Date: {format(courseInfo.startDate, "dd MMMM yyyy")}
                    </CardDescription>
                  </div>
                </CardHeader>

                <CardContent className="p-6 text-sm">
                  <div className="grid gap-3">
                    <div className="font-semibold">Course Details</div>
                    <ul className="grid gap-3">
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Category</span>
                        <span>{courseInfo.category}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Season Cycle</span>
                        <span>{getSeason(courseInfo.startDate)}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Registration</span>
                        <span>{courseInfo.isRegistrationOpen ? "Open" : "Closed"}</span>
                      </li>
                    </ul>
                    <Separator className="my-2" />
                    <ul className="grid gap-3">
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Start Date</span>
                        <span>{format(courseInfo.startDate, "dd MMMM yyyy")}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">End Date</span>
                        <span>{format(courseInfo.endDate, "dd MMMM yyyy")}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Duration</span>
                        <span>
                          {differenceInWeeks(courseInfo.endDate, courseInfo.startDate)}{" "}
                          Weeks
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Days</span>
                        <span className="text-right">
                          {courseInfo.days?.length === 0
                            ? "-"
                            : "Every " +
                              courseInfo.days?.map((day, index) =>
                                courseInfo.days?.length === index + 1
                                  ? ` and ${day.label}`
                                  : ` ${day.label}`,
                              )}
                        </span>
                      </li>
                    </ul>
                  </div>
                  <Separator className="my-4" />
                  <div className="grid gap-3">
                    <div className="font-semibold">Facilitator Information</div>
                    <dl className="grid gap-3">
                      <div className="flex items-center justify-between gap-5">
                        <dt className="text-muted-foreground">Name</dt>
                        <dd>
                          {courseInfo.fellow?.firstName +
                            " " +
                            courseInfo.fellow?.lastName}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-5">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd>
                          <a href="mailto:">{courseInfo.fellow?.email}</a>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-5">
                        <dt className="text-muted-foreground">Phone</dt>
                        <dd>
                          <a href="tel:">{courseInfo.fellow?.tel}</a>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <Separator className="my-4" />
                  <div className="grid auto-rows-max gap-3">
                    <div className="font-semibold">Students</div>
                    <ScrollArea className="w-full">
                      {courseInfo.students && (
                        <UserSettingDialog
                          users={courseInfo.students}
                          courseId={courseInfo.id}
                        />
                      )}
                      {!courseInfo.students?.length && <p>No students found</p>}
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
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

CourseInfo.displayName = "CourseInfo";

import { useCourseState } from "@/lib/providers/CourseState.provider";
import { differenceInWeeks, format } from "date-fns";
import { cn, getSeason } from "@/lib/utils/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

import { Copy } from "lucide-react";
import { UserAvatar } from "./info.avatars";
import { useWindowSize } from "@uidotdev/usehooks";
import { toast } from "sonner";
import { InfoFooter } from "./info.footer";
import { Separator } from "@/components/ui/separator";
import { forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CourseInfoProps = {
  className?: string;
  mode: "dialog" | "flex";
};

export const CourseInfo = forwardRef<HTMLDivElement, CourseInfoProps>(
  ({ className, mode }, ref) => {
    const {
      state: { courseInfo, isCourseSelected },
    } = useCourseState();
    const { width } = useWindowSize();

    const showCourseInfo = Object.values(isCourseSelected ?? false)[0] ?? false;

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
            <Card>
              <ScrollArea className="overflow-y-auto" type="hover">
                <CardHeader className="flex flex-row items-start bg-muted/50">
                  <div className="grid gap-0.5">
                    <CardTitle className="group flex items-center gap-2 text-lg">
                      <span
                        className=""
                        dir={courseInfo.enTitle ? "ltr" : "rtl"}
                      >
                        {courseInfo.enTitle || courseInfo.arTitle}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          navigator.clipboard
                            .writeText(
                              (courseInfo.enTitle ||
                                courseInfo.arTitle) as string,
                            )
                            .then(() => {
                              toast.success("Copied!");
                            });
                        }}
                      >
                        <Copy className="h-3 w-3" />
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
                        <span className="text-muted-foreground">
                          Season Cycle
                        </span>
                        <span>{getSeason(courseInfo.startDate)}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">
                          Registration
                        </span>
                        <span>
                          {courseInfo.isRegistrationOpen ? "Open" : "Closed"}
                        </span>
                      </li>
                    </ul>
                    <Separator className="my-2" />
                    <ul className="grid gap-3">
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">
                          Start Date
                        </span>
                        <span>
                          {format(courseInfo.startDate, "dd MMMM yyyy")}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">End Date</span>
                        <span>
                          {format(courseInfo.endDate, "dd MMMM yyyy")}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Duration</span>
                        <span>
                          {differenceInWeeks(
                            courseInfo.endDate,
                            courseInfo.startDate,
                          )}{" "}
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
                    {/* //TODO -> Adding students */}
                    <div className="font-semibold">Pegons</div>
                    <ScrollArea className="w-full rounded-md p-4">
                      <div className="flex gap-1 text-muted-foreground">
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                        <UserAvatar />
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </CardContent>
              </ScrollArea>
              {width && width >= 1024 && <InfoFooter />}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

CourseInfo.displayName = "CourseInfo";

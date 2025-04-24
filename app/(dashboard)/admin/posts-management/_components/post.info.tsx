import { Button } from "@/components/hoc/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";

import { useWindowSize } from "@uidotdev/usehooks";
import { AnimatePresence, motion } from "framer-motion";
import { Copy } from "lucide-react";
import { forwardRef } from "react";
import { toast } from "sonner";
import { InfoFooter } from "../../course-management/_components/info/course.info.footer";
import { usePostsStore } from "../_lib/posts.slice";

type PostInfoProps = {
  className?: string;
  mode: "dialog" | "flex";
};

export const PostInfo = forwardRef<HTMLDivElement, PostInfoProps>(
  ({ className, mode }, ref) => {
    const { postInfo, selectedPost } = usePostsStore();

    const { width } = useWindowSize();

    const showCourseInfo = Object.values(selectedPost ?? false)[0] ?? false;

    return (
      <AnimatePresence>
        {showCourseInfo && postInfo && (
          <motion.div
            className={cn(`flex w-full flex-col justify-between`, className)}
            initial={mode === "flex" && { x: "50vw", width: 0 }}
            animate={mode === "flex" && { x: 0, width: "50%" }}
            exit={mode === "flex" ? { x: "50vw", width: 0 } : undefined}
            ref={ref}
          >
            <Card className="overflow-y-auto">
              <ScrollArea type="hover" className="h-[calc(100%-60px)]">
                <CardHeader className="bg-accent flex flex-row items-start">
                  <div className="grid gap-0.5">
                    <CardTitle className="group flex items-center gap-2 text-lg">
                      <span className="" dir={postInfo.enTitle ? "ltr" : "rtl"}>
                        {postInfo.enTitle || postInfo.arTitle}
                      </span>
                      <Button
                        size="icon"
                        variant="outline"
                        icon={<Copy className="p-0.5" />}
                        className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => {
                          navigator.clipboard
                            .writeText((postInfo.enTitle || postInfo.arTitle) as string)
                            .then(() => {
                              toast.success("Copied!");
                            });
                        }}
                      >
                        <span className="sr-only">Copy Course Name</span>
                      </Button>
                    </CardTitle>
                    {postInfo.publishedAt && (
                      <CardDescription>
                        Date: {format(postInfo.publishedAt, "dd MMMM yyyy")}
                      </CardDescription>
                    )}
                  </div>
                </CardHeader>

                {/* <CardContent className="p-6 text-sm">
                  <div className="grid gap-3">
                    <div className="font-semibold">Course Details</div>
                    <ul className="grid gap-3">
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Category</span>
                        <span>{postInfo.category}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Season Cycle</span>
                        <span>{getSeason(postInfo.startDate)}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Registration</span>
                        <span>{postInfo.isRegistrationOpen ? "Open" : "Closed"}</span>
                      </li>
                    </ul>
                    <Separator className="my-2" />
                    <ul className="grid gap-3">
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Start Date</span>
                        <span>{format(postInfo.startDate, "dd MMMM yyyy")}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">End Date</span>
                        <span>{format(postInfo.endDate, "dd MMMM yyyy")}</span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Duration</span>
                        <span>
                          {differenceInWeeks(postInfo.endDate, postInfo.startDate)} Weeks
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-5">
                        <span className="text-muted-foreground">Days</span>
                        <span className="text-right">
                          {postInfo.days?.length === 0
                            ? "-"
                            : "Every " +
                              postInfo.days?.map((day, index) =>
                                postInfo.days?.length === index + 1
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
                          {postInfo.fellow?.firstName + " " + postInfo.fellow?.lastName}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-5">
                        <dt className="text-muted-foreground">Email</dt>
                        <dd>
                          <a href="mailto:">{postInfo.fellow?.email}</a>
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-5">
                        <dt className="text-muted-foreground">Phone</dt>
                        <dd>
                          <a href="tel:">{postInfo.fellow?.tel}</a>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <Separator className="my-4" />
                  <div className="grid auto-rows-max gap-3">
                    <div className="font-semibold">Students</div>
                    <ScrollArea className="w-full rounded-md p-4">
                      <div className="text-muted-foreground flex gap-1">
                        {postInfo.students &&
                          postInfo.students.map((student) => (
                            <UserAvatar
                              key={student.id}
                              user={student}
                              courseId={postInfo.id}
                            />
                          ))}
                        {!postInfo.students?.length && <p>No students found</p>}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                </CardContent> */}
              </ScrollArea>
              {width && width >= 1024 && <InfoFooter />}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

PostInfo.displayName = "CourseInfo";

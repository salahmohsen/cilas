import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Ellipsis, Target } from "lucide-react";
import { Bundle } from "@/actions/bundles.actions";
import { format } from "date-fns";
import { useCourseState } from "@/providers/CourseState.provider";
import { useCallback } from "react";
import { getSafeCourses, getUnbundledCourses } from "@/actions/courses.actions";
import { toast } from "sonner";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import MultipleSelector from "@/components/ui/multipleSelector";

export const BundleItem = ({ bundle }: { bundle: Bundle }) => {
  const {
    courses,
    courseInfo,
    setCourseInfo,
    setCourses,
    isCourseSelected,
    setIsCourseSelected,
    isBundleSelected,
    setIsBundleSelected,
  } = useCourseState();

  const getBundleCourses = useCallback(
    async (selectedCourseId?: number) => {
      const idArr = bundle.courses.map((course) => course.id);
      if (idArr.length > 0) {
        try {
          const data = await getSafeCourses(undefined, undefined, idArr);
          if (!data.error) {
            setCourses(data.safeCourses);
            if (selectedCourseId) {
              const selectedCourse = data.safeCourses?.find(
                (c) => c.id === selectedCourseId,
              );
              if (selectedCourse) setCourseInfo(selectedCourse);
            }
          } else {
            throw new Error(data.message);
          }
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "An error occurred",
          );
        }
      }
    },
    [bundle.courses, setCourseInfo, setCourses],
  );

  const handleCourseSelect = useCallback(
    (id: number, e: React.MouseEvent) => {
      e.stopPropagation();

      // Always select the current bundle
      setIsBundleSelected((prev) => ({
        [bundle.id]: prev[bundle.id] ? undefined : !prev[bundle.id],
      }));

      const courseToFind = courses?.find((c) => c.id === id);
      if (courseToFind) {
        setCourseInfo(courses?.find((c) => c.id === id));
      } else {
        getBundleCourses(id);
      }
      if (bundle.courses.length > 0) {
        setIsCourseSelected((prev) => ({
          [id]: !prev[id],
        }));
      }
    },
    [
      bundle.courses.length,
      bundle.id,
      courses,
      getBundleCourses,
      setCourseInfo,
      setIsBundleSelected,
      setIsCourseSelected,
    ],
  );

  const handleBundleSelect = (id: number) => {
    setIsBundleSelected((prev) => ({
      [id]: prev[id] ? undefined : !prev[id],
    }));
    setIsCourseSelected({});
    getBundleCourses();
  };

  return (
    <li
      className={`flex items-center justify-between gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!scale-[1.02] lg:hover:bg-accent lg:hover:!opacity-100 ${isBundleSelected[bundle.id] ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"}`}
      onClick={() => handleBundleSelect(bundle.id)}
    >
      <div className="flex flex-col gap-4">
        <span className="flex gap-1 text-xs font-light">
          <Badge
            variant="outline"
            className="h-6 min-w-max max-w-max rounded-sm"
          >
            {bundle.cycle} {bundle.year}
          </Badge>
          <Badge
            variant="outline"
            className="h-6 min-w-max max-w-max rounded-sm"
          >
            {bundle.category}
          </Badge>
          <Badge
            variant="outline"
            className="h-6 min-w-max max-w-max rounded-sm"
          >
            {bundle.attendance}
          </Badge>
        </span>
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:gap-2">
          <div className="flex flex-col flex-wrap gap-2">
            {bundle.courses.length > 0 ? (
              bundle.courses
                .sort((a, b) => b.id - a.id)
                .map((course) => (
                  <Badge
                    variant={
                      isCourseSelected[course.id] ? "default" : "outline"
                    }
                    className="h-6 min-w-max max-w-max cursor-pointer rounded-sm font-normal"
                    key={course.id}
                    onClick={(e) => handleCourseSelect(course.id, e)}
                  >
                    {course.enTitle || course.arTitle}
                  </Badge>
                ))
            ) : (
              <Badge
                variant="destructive"
                className="h-6 min-w-max max-w-max rounded-sm font-normal"
              >
                No courses found for this bundle
              </Badge>
            )}
          </div>
        </div>
        <p className="flex gap-1 text-xs font-light">
          <Target size={16} strokeWidth={1.5} />
          <span>Deadline {format(bundle.deadline, "d MMM yyyy")}</span>
        </p>
      </div>
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className={`h-8 w-8 bg-background text-foreground`}
            >
              <Ellipsis className="h-3.5 w-3.5" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <Link href={`/dashboard/courses/edit-bundle?id=${bundle.id}`}>
              <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                Edit Bundle
              </DropdownMenuItem>
            </Link>

            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <Drawer>
                <DrawerTrigger>Update Courses</DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Update Bundle Courses</DrawerTitle>
                    <DrawerDescription>
                      <MultipleSelector
                        onSearch={getUnbundledCourses}
                        triggerSearchOnFocus={false}
                        placeholder="Select unbundled courses"
                        emptyIndicator={
                          <p className="flex w-full items-center justify-center text-sm leading-10 text-gray-600 dark:text-gray-400">
                            No Courses found!
                          </p>
                        }
                      />
                    </DrawerDescription>
                  </DrawerHeader>
                  <DrawerFooter>
                    <Button>Submit</Button>
                    <DrawerClose>
                      <Button variant="outline">Cancel</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => e.stopPropagation()}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
};

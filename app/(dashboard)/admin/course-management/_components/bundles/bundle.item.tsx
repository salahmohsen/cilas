"use client";

import { Badge } from "@/components/ui/badge";
import { fetchCourses } from "@/lib/actions/courses.actions";
import { useCourseStore } from "@/lib/store/course.slice";
import {
  BundleWithCourseTitles,
  CourseWithFellowAndStudents,
} from "@/lib/types/drizzle.types";
import { cn } from "@/lib/utils/utils";
import { format } from "date-fns";
import { PanelRightClose, PanelRightOpen, Rabbit, Target } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BundleOptions } from "./bundle.options";
import { BundleSkeleton } from "./bundle.skeleton";

export const BundleItem = ({ bundle }: { bundle: BundleWithCourseTitles }) => {
  const { isBundleSelected, isLoading, setCourses } = useCourseStore();

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [coursesData, setCoursesData] = useState<
    CourseWithFellowAndStudents[] | undefined
  >(undefined);

  useEffect(() => {
    const fetchBundleCoursesData = async () => {
      const bundleCoursesIds = bundle.courses.map((course) => course.id);
      if (bundleCoursesIds.length > 0) {
        const bundleCourses = await fetchCourses(undefined, undefined, bundleCoursesIds);
        if (!bundleCourses.error && bundleCourses.courses) {
          setCoursesData(bundleCourses.courses);
        }
      }
    };
    fetchBundleCoursesData();
  }, [bundle]);

  const handleBundleClick = () => {
    // This will set the courses which courseInfo will use it to toggle between next and prev
    setCourses(coursesData ?? []);
  };

  return (
    <li
      className={`${isBundleSelected?.[bundle.id] || isOptionsMenuOpen ? "bg-accent scale-[1.01]! opacity-100!" : "bg-transparent"} group/item lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:opacity-100!`}
      onClick={handleBundleClick}
    >
      <div
        className={`lg:hover:bg-accent relative gap-5 rounded-md border px-5 py-6 font-medium transition-all duration-300 lg:hover:scale-[1.01]!`}
      >
        <div className="flex flex-col gap-4">
          <BundleOptions
            bundleId={bundle.id}
            isOptionsMenuOpen={isOptionsMenuOpen}
            setIsOptionsMenuOpen={setIsOptionsMenuOpen}
          />
          <div className={`flex flex-col gap-2 pr-12 font-light lg:flex-row lg:pr-0`}>
            <Badge className={`h-6 rounded-sm`}>
              {bundle.cycle} {bundle.year}
            </Badge>
            <Badge variant="outline" className="h-6 rounded-sm">
              {bundle.category}
            </Badge>
            <Badge variant="outline" className="h-6 rounded-sm">
              {bundle.attendance}
            </Badge>
          </div>
          <div>
            <ul className="space-y-2 border-y py-3">
              {isLoading && <BundleSkeleton itemsNumber={10} />}
              {!isLoading &&
                coursesData &&
                coursesData.length > 0 &&
                coursesData
                  .sort((a, b) => b.id - a.id)
                  .map((course) => (
                    <BundleCourse key={course.id} bundle={bundle} course={course} />
                  ))}
              {!isLoading && bundle.courses.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2">
                  <Rabbit size={50} strokeWidth={0.5} />
                  No Courses Found
                </div>
              )}
            </ul>
          </div>
          <p className="flex w-full gap-1 text-xs font-light">
            <Target size={16} strokeWidth={1.5} />
            <span>Registration Deadline {format(bundle.deadline, "d MMM yyyy")}</span>
          </p>
        </div>
      </div>
    </li>
  );
};

const BundleCourse = ({
  bundle,
  course,
}: {
  bundle: BundleWithCourseTitles;
  course: CourseWithFellowAndStudents;
}) => {
  const {
    isCourseSelected,
    isBundleSelected,
    setCourseInfo,
    setBundleSelected,
    setCourseSelected,
  } = useCourseStore();

  const handleCourseSelect = useCallback(() => {
    setCourseInfo(course);
    setBundleSelected({ [bundle.id]: isBundleSelected ? true : false });
    setCourseSelected({ [course.id]: !isCourseSelected?.[course.id] });
  }, [
    setCourseInfo,
    course,
    setBundleSelected,
    bundle.id,
    isBundleSelected,
    setCourseSelected,
    isCourseSelected,
  ]);

  const panelRightIcon = isCourseSelected?.[course.id] ? (
    <PanelRightOpen
      className={cn(
        `hidden transition-opacity duration-200 ease-in-out group-hover:block`,
        isCourseSelected?.[course.id] ? "block" : "hidden",
      )}
      size={20}
    />
  ) : (
    <PanelRightClose
      className={cn(
        `hidden transition-opacity duration-200 ease-in-out group-hover:block`,
        isCourseSelected?.[course.id] ? "block" : "hidden",
      )}
      size={20}
    />
  );

  return (
    <div>
      <li
        className={`group/courses flex max-w-max cursor-pointer items-center gap-2`}
        onClick={handleCourseSelect}
      >
        <p
          className={cn(
            "group flex gap-2 text-sm transition-transform duration-200 ease-in-out",
            isCourseSelected?.[course.id]
              ? `bg-foreground text-background translate-x-2 rounded-md px-2 py-1`
              : "translate-x-0",
          )}
        >
          {panelRightIcon}
          {course.enTitle || course.arTitle}
        </p>
      </li>
    </div>
  );
};

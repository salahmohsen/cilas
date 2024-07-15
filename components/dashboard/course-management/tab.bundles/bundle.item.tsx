import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PanelRightClose, PanelRightOpen, Rabbit, Target } from "lucide-react";
import { format } from "date-fns";
import { useCourseState } from "@/providers/CourseState.provider";
import { BundleOptions } from "./bundle.options";
import { BundleSkeleton } from "./bundle.skeleton";
import {
  BundleWithCoursesNames,
  CourseWithSafeFellow,
} from "@/types/drizzle.types";
import { getSafeCourses } from "@/actions/courses.actions";
import { cn } from "@/lib/utils";

export const BundleItem = ({ bundle }: { bundle: BundleWithCoursesNames }) => {
  const {
    state: { isBundleSelected, isLoading },
    dispatch,
  } = useCourseState();

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [coursesData, setCoursesData] = useState<
    CourseWithSafeFellow[] | undefined
  >(undefined);

  useEffect(() => {
    const fetchBundleCoursesData = async () => {
      const bundleCoursesIds = bundle.courses.map((course) => course.id);
      if (bundleCoursesIds.length > 0) {
        const bundleCourses = await getSafeCourses(
          undefined,
          undefined,
          bundleCoursesIds,
        );
        if (!bundleCourses.error && bundleCourses.courses) {
          setCoursesData(bundleCourses.courses);
        }
      }
    };
    fetchBundleCoursesData();
  }, [bundle]);

  const handleBundleClick = () => {
    // This will set the courses which courseInfo will use it to toggle between next and prev
    dispatch({ type: "SET_COURSES", payload: coursesData ?? [] });
  };

  return (
    <li
      className={`${isBundleSelected?.[bundle.id] || isOptionsMenuOpen ? "!scale-[1.01] bg-accent !opacity-100" : "bg-transparent"} group/item lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!opacity-100`}
      onClick={handleBundleClick}
    >
      <div
        className={`relative gap-5 rounded-md border px-5 py-6 font-medium transition-all duration-300 lg:hover:!scale-[1.01] lg:hover:bg-accent`}
      >
        <div className="flex flex-col gap-4">
          <BundleOptions
            bundleId={bundle.id}
            isOptionsMenuOpen={isOptionsMenuOpen}
            setIsOptionsMenuOpen={setIsOptionsMenuOpen}
          />
          <div
            className={`flex flex-col gap-2 pr-12 font-light lg:flex-row lg:pr-0`}
          >
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
                    <BundleCourse
                      key={course.id}
                      bundle={bundle}
                      course={course}
                    />
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
            <span>
              Registration Deadline {format(bundle.deadline, "d MMM yyyy")}
            </span>
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
  bundle: BundleWithCoursesNames;
  course: CourseWithSafeFellow;
}) => {
  const {
    state: { isCourseSelected, isBundleSelected },
    dispatch,
  } = useCourseState();

  const handleCourseSelect = useCallback(() => {
    dispatch({ type: "SET_COURSE_INFO", payload: course });
    dispatch({
      type: "SET_BUNDLE_SELECTED",
      payload: { [bundle.id]: isBundleSelected ? true : false },
    });
    dispatch({
      type: "SET_COURSE_SELECTED",
      payload: { [course.id]: !isCourseSelected?.[course.id] },
    });
  }, [dispatch, course, bundle.id, isCourseSelected, isBundleSelected]);

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
              ? `translate-x-2 rounded-md bg-foreground px-2 py-1 text-background`
              : "translate-x-0 before:content-['⏺']",
          )}
        >
          {panelRightIcon}
          {course.enTitle || course.arTitle}
        </p>
      </li>
    </div>
  );
};

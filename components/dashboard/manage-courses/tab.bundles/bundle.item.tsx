import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PanelRightOpen, Rabbit, Target } from "lucide-react";
import { format } from "date-fns";
import { useCourseState } from "@/providers/CourseState.provider";
import { BundleOptions } from "./bundle.options";
import { BundleSkeleton } from "./bundle.skeleton";
import { BundleWithCoursesNames } from "@/types/drizzle.types";
import { getSafeCourses } from "@/actions/courses.actions";

export const BundleItem = ({ bundle }: { bundle: BundleWithCoursesNames }) => {
  const {
    state: { isBundleSelected, isLoading, bundles },
    dispatch,
  } = useCourseState();

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);

  const handleBundleSelect = useCallback(
    async (bundleId: number) => {
      dispatch({ type: "SET_BUNDLE_SELECTED", payload: {} });
      const selectedBundle = bundles.find((bundle) => bundle.id === bundleId);
      const bundleCoursesIds = selectedBundle?.courses.map(
        (course) => course.id,
      );
      if (bundleCoursesIds && bundleCoursesIds.length > 0) {
        const bundleCourses = await getSafeCourses(
          undefined,
          undefined,
          bundleCoursesIds,
        );
        if (!bundleCourses.error && bundleCourses.courses) {
          dispatch({ type: "SET_COURSES", payload: bundleCourses.courses });
        }
      }
    },
    [dispatch, bundles],
  );

  return (
    <li
      className={`${isBundleSelected?.[bundle.id] || isOptionsMenuOpen ? "!scale-[1.01] bg-accent !opacity-100" : "bg-transparent"} group/item lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!opacity-100`}
    >
      <div
        className={`relative gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:hover:!scale-[1.01] lg:hover:bg-accent`}
        onClick={() => handleBundleSelect(bundle.id)}
      >
        <div className="flex flex-col gap-4">
          <BundleOptions
            bundleId={bundle.id}
            isOptionsMenuOpen={isOptionsMenuOpen}
            setIsOptionsMenuOpen={setIsOptionsMenuOpen}
          />
          <div
            className={`flex flex-col gap-2 pr-12 text-xs font-light lg:flex-row lg:pr-0`}
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
            <ul className="space-y-3">
              {isLoading && <BundleSkeleton itemsNumber={10} />}
              {!isLoading &&
                bundle.courses.length > 0 &&
                bundle.courses
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
          <p className="flex w-full gap-1 border-t-2 pt-4 text-xs font-light">
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
  course: {
    id: number;
    enTitle: string | null;
    arTitle: string | null;
  };
}) => {
  const {
    optimisticCourses,
    state: { isLoading, isCourseSelected },
    dispatch,
  } = useCourseState();

  const handleCourseSelect = useCallback(
    (id: number, e: React.MouseEvent) => {
      const courseToFind = optimisticCourses?.find((c) => c.id === id);
      dispatch({ type: "SET_COURSE_INFO", payload: courseToFind });

      if (bundle.courses.length > 0) {
        dispatch({
          type: "SET_COURSE_SELECTED",
          payload: { [id]: !isCourseSelected?.[id] },
        });
      }
    },
    [bundle.courses.length, dispatch, optimisticCourses, isCourseSelected],
  );

  return (
    <div>
      {!isLoading && (
        <li
          className={`group/courses flex max-w-max cursor-pointer items-center gap-2 hover:underline ${isCourseSelected?.[course.id] && "before:content-['-->']"}`}
          onClick={(e) => handleCourseSelect(course.id, e)}
        >
          <p>{course.enTitle || course.arTitle}</p>
          <PanelRightOpen
            className="opacity-0 transition-opacity duration-200 ease-in-out group-hover/courses:opacity-100"
            size={16}
          />
        </li>
      )}
    </div>
  );
};

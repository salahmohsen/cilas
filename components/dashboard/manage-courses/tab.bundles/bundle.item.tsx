import { createContext, Dispatch, SetStateAction, useCallback, useContext, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { PanelRightOpen, Rabbit, Target } from "lucide-react";
import { format } from "date-fns";
import { useCourseState } from "@/providers/CourseState.provider";
import { BundleOptions } from "./options";
import { BundleSkeleton } from "./bundle.skeleton";
import { BundleWithCoursesNames } from "@/types/drizzle.types";
import { getSafeCourses } from "@/actions/courses.actions";

type BundleContext = {
  bundle: BundleWithCoursesNames;
  isOptionsMenuOpen: boolean;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
};
const BundleContext = createContext({} as BundleContext);
export const useBundle = (): BundleContext => {
  const bundleContext = useContext(BundleContext);
  if (!bundleContext) throw new Error("useBundleState must be used within bundle context.");
  return bundleContext;
};

export const BundleItem = ({ bundle }: { bundle: BundleWithCoursesNames }) => {
  const { setCourses, bundles, isBundleSelected, setIsBundleSelected, isLoading } =
    useCourseState();
  const handleBundleSelect = useCallback(
    async (bundleId: number) => {
      setIsBundleSelected({});
      const selectedBundle = bundles.find((bundle) => bundle.id === bundleId);
      const bundleCoursesIds = selectedBundle?.courses.map((course) => course.id);
      if (bundleCoursesIds && bundleCoursesIds.length > 0) {
        const bundleCourses = await getSafeCourses(undefined, undefined, bundleCoursesIds);
        if (!bundleCourses.error && bundleCourses.courses) setCourses(bundleCourses.courses);
      }
    },
    [bundles, setCourses, setIsBundleSelected],
  );

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState<boolean>(false);

  return (
    <BundleContext.Provider value={{ bundle, isOptionsMenuOpen, setIsOptionsMenuOpen }}>
      <li
        className={`${isBundleSelected?.[bundle.id] || isOptionsMenuOpen ? "!scale-[1.01] bg-accent !opacity-100" : "bg-transparent"} group/item lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!opacity-100`}
      >
        <div
          className={`relative gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:hover:!scale-[1.01] lg:hover:bg-accent`}
          onClick={() => handleBundleSelect(bundle.id)}
        >
          <div className="flex flex-col gap-4">
            <BundleOptions />
            <div className={`flex flex-col gap-2 pr-12 text-xs font-light lg:flex-row lg:pr-0`}>
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
            <p className="flex w-full gap-1 border-t-2 pt-4 text-xs font-light">
              <Target size={16} strokeWidth={1.5} />
              <span>Registration Deadline {format(bundle.deadline, "d MMM yyyy")}</span>
            </p>
          </div>
        </div>
      </li>
    </BundleContext.Provider>
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
  const { optimisticCourses, setCourseInfo, isCourseSelected, setIsCourseSelected, isLoading } =
    useCourseState();

  const handleCourseSelect = useCallback(
    (id: number, e: React.MouseEvent) => {
      const courseToFind = optimisticCourses?.find((c) => c.id === id);
      setCourseInfo(courseToFind);

      if (bundle.courses.length > 0) {
        setIsCourseSelected((prev) => ({
          [id]: !prev?.[id],
        }));
      }
    },
    [bundle.courses.length, optimisticCourses, setCourseInfo, setIsCourseSelected],
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

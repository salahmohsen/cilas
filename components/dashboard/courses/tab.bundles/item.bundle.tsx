import {
  createContext,
  Dispatch,
  SetStateAction,
  useCallback,
  useContext,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";

import {
  Egg,
  GitCommitVertical,
  PanelRightOpen,
  Rabbit,
  Target,
} from "lucide-react";
import { Bundle } from "@/actions/bundles.actions";
import { format } from "date-fns";
import { useCourseState } from "@/providers/CourseState.provider";
import { getSafeCourses } from "@/actions/courses.actions";
import { toast } from "sonner";
import { BundleOptions } from "./options";
import { useWindowSize } from "@uidotdev/usehooks";

type BundleContext = {
  bundle: Bundle;
  isOptionsMenuOpen: boolean;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
};
const BundleContext = createContext({} as BundleContext);
export const useBundle = (): BundleContext => {
  const bundleContext = useContext(BundleContext);
  if (!bundleContext)
    throw new Error("useBundleState must be used within bundle context.");
  return bundleContext;
};

export const BundleItem = ({ bundle }: { bundle: Bundle }) => {
  const { width } = useWindowSize();

  const {
    courses,
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

      setIsBundleSelected((prev) => ({
        [id]: prev[id] ? undefined : !prev[id],
      }));

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

  const handleBundleSelect = useCallback(
    (id: number) => {
      setIsBundleSelected({});
      setIsCourseSelected({});
      getBundleCourses();
    },
    [getBundleCourses, setIsBundleSelected, setIsCourseSelected],
  );

  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState<boolean>(false);

  return (
    <BundleContext.Provider
      value={{ bundle, isOptionsMenuOpen, setIsOptionsMenuOpen }}
    >
      <li
        className={`${isBundleSelected[bundle.id] || isOptionsMenuOpen ? "!scale-[1.02] bg-accent !opacity-100" : "bg-transparent"} group/item lg:group-hover/list:scale-100 lg:group-hover/list:opacity-50 lg:hover:!opacity-100`}
      >
        <div
          className={`relative cursor-pointer gap-5 rounded-md border px-5 py-6 text-sm font-medium transition-all duration-300 lg:hover:!scale-[1.02] lg:hover:bg-accent`}
          onClick={() => handleBundleSelect(bundle.id)}
        >
          <div className="flex flex-col gap-4">
            <BundleOptions />
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
                {bundle.courses.length > 0 ? (
                  bundle.courses
                    .sort((a, b) => b.id - a.id)
                    .map((course) => (
                      <li
                        className={`group/courses flex max-w-max cursor-pointer items-center gap-2 hover:underline ${isCourseSelected[course.id] && "before:content-['-->']"}`}
                        key={course.id}
                        onClick={(e) => handleCourseSelect(course.id, e)}
                      >
                        <p>{course.enTitle || course.arTitle}</p>
                        <PanelRightOpen
                          className="opacity-0 transition-opacity duration-200 ease-in-out group-hover/courses:opacity-100"
                          size={16}
                        />
                      </li>
                    ))
                ) : (
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
    </BundleContext.Provider>
  );
};

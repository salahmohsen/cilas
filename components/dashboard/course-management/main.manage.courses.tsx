"use client";

import { useRef, createContext } from "react";
import { cn } from "@/lib/utils";
import { useCourseState } from "@/providers/CourseState.provider";
import { useWindowSize } from "@uidotdev/usehooks";

import { MotionCourseInfo } from "@/components/dashboard/course-management/info/info";
import { CourseInfoModal } from "@/components/dashboard/course-management/info/info.modal";

import { Tabs } from "@/components/ui/tabs";

import { DraftTab } from "./courses/tab.draft/tab.draft";
import { BundlesTab } from "./tab.bundles/tab.bundles";
import { PublishedTab } from "./courses/tab.published/tab.published";
import { TabsList } from "./tab.list";
import { Tab } from "@/types/manage.courses.types";
import { motion, AnimatePresence } from "framer-motion";
import { useCourseNavigation } from "./useCourseNavigation";

type CourseNavContext = {
  handleNext: () => void;
  handlePrev: () => void;
  containerRef: React.RefObject<HTMLUListElement>;
};

export const courseNavContext = createContext<CourseNavContext>(
  {} as CourseNavContext,
);

export default function ManageCourses() {
  const { width } = useWindowSize();

  const {
    state: { isCourseSelected, activeTab },
    dispatch,
  } = useCourseState();

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useCourseNavigation(containerRef);

  const isDesktop = width && width >= 1024;
  const showCourseInfo =
    isDesktop && Object.values(isCourseSelected ?? false)[0];

  return (
    <courseNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
      <div className="flex min-h-screen gap-5 overflow-x-clip px-2">
        <div className={cn("w-full")}>
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              dispatch({
                type: "SET_ACTIVE_TAB",
                payload: value as Tab,
              })
            }
            className={cn(`flex flex-col gap-2`)}
          >
            <TabsList />
            <PublishedTab />
            <DraftTab />
            <BundlesTab />
          </Tabs>
        </div>
        <AnimatePresence>
          {isDesktop && showCourseInfo && (
            <MotionCourseInfo
              key={`course-info-${showCourseInfo}`}
              initial={{ x: "50vw", width: 0 }}
              animate={{ x: 0, width: "50%" }}
              exit={{ x: "50vw", width: 0 }}
              // transition={{ duration: 0.5, ease: "easeInOut" }}
              className="sticky top-20 mt-14 max-h-[calc(85vh)]"
            />
          )}
        </AnimatePresence>
      </div>
      {!isDesktop && <CourseInfoModal />}
    </courseNavContext.Provider>
  );
}

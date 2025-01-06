"use client";

import { useRef, createContext, useCallback } from "react";
import { cn } from "@/lib/utils/utils";
import { useCourseState } from "@/lib/providers/CourseState.provider";
import { useWindowSize } from "@uidotdev/usehooks";

import { CourseInfo } from "@/components/dashboard/course-management/info/info";

import { Tabs } from "@/components/ui/tabs";

import { DraftTab } from "./courses/tab.draft/tab.draft";
import { BundlesTab } from "./tab.bundles/tab.bundles";
import { PublishedTab } from "./courses/tab.published/tab.published";
import { TabsList } from "./tab.list";
import { Tab } from "@/lib/types/manage.courses.types";
import { useCourseNavigation } from "./useCourseNavigation";
import { CourseInfoModal } from "./info/info.modal";

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
    state: { activeTab },
    dispatch,
  } = useCourseState();

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useCourseNavigation(containerRef);

  const isDesktop = width && width >= 1024;

  const onTabChange = useCallback(
    (tab: string) => {
      dispatch({
        type: "SET_ACTIVE_TAB",
        payload: tab as Tab,
      });
      dispatch({
        type: "SET_COURSE_SELECTED",
        payload: null,
      });
    },
    [dispatch],
  );
  return (
    <courseNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
      <div className="flex min-h-screen gap-5 overflow-x-clip px-2">
        <div className={cn("w-full")}>
          <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className={cn(`flex flex-col gap-2`)}
          >
            <TabsList />
            <PublishedTab />
            <DraftTab />
            <BundlesTab />
          </Tabs>
        </div>
        {isDesktop && (
          <CourseInfo
            className="sticky top-20 mt-14 max-h-[calc(85vh)]"
            mode="flex"
          />
        )}
      </div>
      {!isDesktop && <CourseInfoModal />}
    </courseNavContext.Provider>
  );
}

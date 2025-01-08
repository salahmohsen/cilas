"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { createContext, useCallback, useRef } from "react";

import { CourseInfo } from "@/app/(dashboard)/admin/course-management/_components/info/info";

import { Tabs } from "@/components/ui/tabs";

import { useCourseStore } from "@/lib/store/course.slice";
import { Tab } from "@/lib/types/manage.courses.types";
import { DraftTab } from "./courses/tab.draft/tab.draft";
import { PublishedTab } from "./courses/tab.published/tab.published";
import { CourseInfoModal } from "./info/info.modal";
import { BundlesTab } from "./tab.bundles/tab.bundles";
import { TabsList } from "./tab.list";
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

  const { activeTab, setActiveTab, setCourseSelected } = useCourseStore();

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useCourseNavigation(containerRef);

  const isDesktop = width && width >= 1024;

  const onTabChange = useCallback(
    (tab: string) => {
      setActiveTab(tab as Tab);
      setCourseSelected(null);
    },
    [setActiveTab, setCourseSelected],
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

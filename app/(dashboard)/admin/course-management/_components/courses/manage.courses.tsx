"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { createContext, useCallback, useEffect, useRef } from "react";

import { CourseInfo } from "@/app/(dashboard)/admin/course-management/_components/info/info";

import { Tabs } from "@/components/ui/tabs";

import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, Tab } from "@/lib/types/course.slice.types";
import { useSearchParams } from "next/navigation";
import { CourseInfoModal } from "../info/info.modal";
import { BundlesTab } from "../tabs/bundles.tab";
import { DraftTab } from "../tabs/draft.tab";
import { TabsList } from "../tabs/list.tab";
import { PublishedTab } from "../tabs/published.tab";
import { useCourseNavigation } from "./editor/hooks/useCourseNavigation";

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
    activeTab,
    setActiveTab,
    setCourseSelected,
    getCourses,
    setFilter,
    filter,
  } = useCourseStore();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab;

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useCourseNavigation(containerRef);

  const isDesktop = width && width >= 1024;

  useEffect(() => {
    setActiveTab(tabParam);
  }, [setActiveTab, tabParam]);

  useEffect(() => {
    if (!activeTab) setActiveTab(Tab.Published);
    getCourses();
  }, [getCourses, activeTab, filter, setActiveTab]);

  const onTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      setCourseSelected(null);
      if (tab === Tab.Published) setFilter(CoursesFilter.AllPublished);
      if (tab === Tab.Draft) setFilter(CoursesFilter.Draft);
    },
    [setActiveTab, setCourseSelected, setFilter],
  );
  return (
    <courseNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
      <div className="flex min-h-screen gap-5 overflow-x-clip px-2">
        <div className={cn("w-full")}>
          <Tabs
            value={activeTab as Tab}
            onValueChange={(tab) => onTabChange(tab as Tab)}
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

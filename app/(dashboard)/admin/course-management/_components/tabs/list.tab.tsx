"use client";

import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, Tab } from "@/lib/types/course.slice.types";
import { Circle, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { FilterButton } from "../courses/filter.button";

export const CoursesTabList = () => {
  const { activeTab, setActiveTab, setFilter } = useCourseStore();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (activeTab === Tab.Published) setFilter(CoursesFilter.AllPublished);
    },
    [activeTab, setActiveTab, setFilter],
  );

  const tabClasses = {
    list: " gap-2  bg-transparent **:gap-1",
    active: "bg-foreground! text-background! text-base px-4 py-2",
    Inactive:
      "border-border! text-primary  border  cursor-pointer hover:bg-accent text-sm",
  };

  return (
    <nav className="flex flex-wrap items-center justify-between gap-1">
      <TabsListUi className={tabClasses.list}>
        <Link href={`/admin/course-management?tab=${Tab.Published}`}>
          <TabsTrigger
            value={Tab.Published}
            id={Tab.Published}
            onClick={() => handleTabClick(Tab.Published)}
            className={
              activeTab === Tab.Published ? tabClasses.active : tabClasses.Inactive
            }
          >
            <Circle size={16} />
            Published
          </TabsTrigger>
        </Link>

        <Link href={`/admin/course-management?tab=${Tab.Draft}`}>
          <TabsTrigger
            value={Tab.Draft}
            id={Tab.Draft}
            onClick={() => handleTabClick(Tab.Draft)}
            className={activeTab === Tab.Draft ? tabClasses.active : tabClasses.Inactive}
          >
            <CircleDashed size={16} />
            Draft
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === Tab.Published && <FilterButton />}
    </nav>
  );
};

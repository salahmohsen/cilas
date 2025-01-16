"use client";

import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, Tab } from "@/lib/types/course.slice.types";
import Link from "next/link";
import { useCallback } from "react";
import { FilterButton } from "./courses/button.filter";

export const TabsList = () => {
  const { activeTab, setActiveTab, setFilter } = useCourseStore();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (activeTab === Tab.Published) setFilter(CoursesFilter.AllPublished);
    },
    [activeTab, setActiveTab, setFilter],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href={`/admin/course-management?tab=${Tab.Published}`}>
          <TabsTrigger
            value={Tab.Published}
            id={Tab.Published}
            onClick={() => handleTabClick(Tab.Published)}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href={`/admin/course-management?tab=${Tab.Draft}`}>
          <TabsTrigger
            value={Tab.Draft}
            id={Tab.Draft}
            onClick={() => handleTabClick(Tab.Draft)}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href={`/admin/course-management?tab=${Tab.Bundles}`}>
          <TabsTrigger
            value={Tab.Bundles}
            id={Tab.Bundles}
            onClick={() => handleTabClick(Tab.Bundles)}
          >
            Bundles
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === Tab.Published && <FilterButton />}
    </div>
  );
};

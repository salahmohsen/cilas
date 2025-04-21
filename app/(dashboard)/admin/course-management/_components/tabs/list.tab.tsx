"use client";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import {
  CoursesFilter,
  CourseTabs,
} from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { Circle, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { FilterButton } from "../courses/filter.button";

export const CoursesTabList = () => {
  const { activeTab, setActiveTab, setFilter } = useCourseStore();

  const handleTabClick = useCallback(
    (tab: CourseTabs) => {
      setActiveTab(tab);
      if (activeTab === CourseTabs.Published) setFilter(CoursesFilter.AllPublished);
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
    <nav className="flex flex-wrap items-center justify-between gap-1 gap-y-4">
      <TabsListUi className={tabClasses.list}>
        <Link href={`/admin/course-management?tab=${CourseTabs.Published}`}>
          <TabsTrigger
            value={CourseTabs.Published}
            id={CourseTabs.Published}
            onClick={() => handleTabClick(CourseTabs.Published)}
            className={
              activeTab === CourseTabs.Published ? tabClasses.active : tabClasses.Inactive
            }
          >
            <Circle size={16} />
            Published
          </TabsTrigger>
        </Link>

        <Link href={`/admin/course-management?tab=${CourseTabs.Draft}`}>
          <TabsTrigger
            value={CourseTabs.Draft}
            id={CourseTabs.Draft}
            onClick={() => handleTabClick(CourseTabs.Draft)}
            className={
              activeTab === CourseTabs.Draft ? tabClasses.active : tabClasses.Inactive
            }
          >
            <CircleDashed size={16} />
            Draft
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === CourseTabs.Published && <FilterButton />}
    </nav>
  );
};

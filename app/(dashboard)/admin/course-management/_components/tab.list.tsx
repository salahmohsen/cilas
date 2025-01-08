"use client";

import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { Tab } from "@/lib/types/manage.courses.types";
import Link from "next/link";
import { useCallback } from "react";
import { FilterButton } from "./courses/button.filter";

export const TabsList = () => {
  const { activeTab, filter, setActiveTab, setFilter } = useCourseStore();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      if (
        filter === "archived" ||
        filter === "ongoing" ||
        filter === "starting soon"
      )
        setFilter("published");
    },
    [filter, setActiveTab, setFilter],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href="/admin/course-management?tab=published">
          <TabsTrigger
            value="published"
            id="published"
            onClick={() => handleTabClick("published")}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href="/admin/course-management?tab=draft">
          <TabsTrigger
            value="draft"
            id="draft"
            onClick={() => handleTabClick("draft")}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href="/admin/course-management?tab=bundles">
          <TabsTrigger
            value="bundles"
            id="bundles"
            onClick={() => handleTabClick("bundles")}
          >
            Bundles
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === "published" && <FilterButton />}
    </div>
  );
};

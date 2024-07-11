"use client";

import Link from "next/link";
import { useCourseState } from "@/providers/CourseState.provider";
import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { FilterButton } from "./courses/button.filter";
import { useCallback } from "react";
import { CoursesFilter, Tab } from "@/types/manage.courses.types";

export const TabsList = () => {
  const {
    state: { activeTab },
    dispatch,
  } = useCourseState();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      dispatch({ type: "SET_ACTIVE_TAB", payload: tab });
    },
    [dispatch],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href="/dashboard/manage-courses?tab=published">
          <TabsTrigger
            value="published"
            id="published"
            onClick={() => handleTabClick("published")}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=draft">
          <TabsTrigger
            value="draft"
            id="draft"
            onClick={() => handleTabClick("draft")}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=bundles">
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

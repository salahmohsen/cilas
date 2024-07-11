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
    (tab: Tab, filter?: CoursesFilter) => {
      dispatch({ type: "SET_FILTER", payload: filter });
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
            onClick={() => handleTabClick("published", "published")}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=draft">
          <TabsTrigger
            value="draft"
            id="draft"
            onClick={() => handleTabClick("draft", "draft")}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=bundles">
          <TabsTrigger
            value="bundles"
            id="bundles"
            onClick={() => handleTabClick("bundles", "published")}
          >
            Bundles
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === "published" && <FilterButton />}
    </div>
  );
};

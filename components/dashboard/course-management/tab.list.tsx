"use client";

import Link from "next/link";
import { useCourseState } from "@/lib/providers/CourseState.provider";
import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { FilterButton } from "./courses/button.filter";
import { useCallback } from "react";
import { Tab } from "@/lib/types/manage.courses.types";

export const TabsList = () => {
  const {
    state: { activeTab, filter },
    dispatch,
  } = useCourseState();

  const handleTabClick = useCallback(
    (tab: Tab) => {
      dispatch({ type: "SET_ACTIVE_TAB", payload: tab });
      if (
        filter === "archived" ||
        filter === "ongoing" ||
        filter === "starting soon"
      )
        dispatch({ type: "SET_FILTER", payload: "published" });
    },
    [dispatch, filter],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href="/dashboard/course-management?tab=published">
          <TabsTrigger
            value="published"
            id="published"
            onClick={() => handleTabClick("published")}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/course-management?tab=draft">
          <TabsTrigger
            value="draft"
            id="draft"
            onClick={() => handleTabClick("draft")}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/course-management?tab=bundles">
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

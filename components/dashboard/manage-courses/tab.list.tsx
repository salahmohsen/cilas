"use client";

import Link from "next/link";
import { useCourseState } from "@/providers/CourseState.provider";
import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { FilterButton } from "./courses/button.filter";

export const TabsList = () => {
  const { state, dispatch } = useCourseState();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href="/dashboard/manage-courses?tab=published">
          <TabsTrigger
            value="published"
            id="published"
            onClick={() => {
              dispatch({ type: "SET_FILTER", payload: "published" });
              dispatch({ type: "SET_ACTIVE_TAB", payload: "published" });
              dispatch({ type: "SET_COURSE_SELECTED", payload: undefined });
            }}
          >
            Published
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=draft">
          <TabsTrigger
            value="draft"
            id="draft"
            onClick={() => {
              dispatch({ type: "SET_FILTER", payload: "draft" });
              dispatch({ type: "SET_ACTIVE_TAB", payload: "draft" });
              dispatch({ type: "SET_COURSE_SELECTED", payload: undefined });
            }}
          >
            Draft
          </TabsTrigger>
        </Link>

        <Link href="/dashboard/manage-courses?tab=bundles">
          <TabsTrigger
            value="bundles"
            id="bundles"
            onClick={() => {
              dispatch({ type: "SET_ACTIVE_TAB", payload: "bundles" });
              dispatch({ type: "SET_COURSE_SELECTED", payload: undefined });
            }}
          >
            Bundles
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {state.activeTab === "published" && <FilterButton />}
    </div>
  );
};

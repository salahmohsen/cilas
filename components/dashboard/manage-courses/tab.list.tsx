"use client";

import Link from "next/link";
import { useCourseState } from "@/providers/CourseState.provider";
import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { FilterButton } from "./courses/button.filter";

export const TabsList = () => {
  const { setFilter, setIsCourseSelected, activeTab, setActiveTab } = useCourseState();

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <TabsListUi>
        <Link href="/dashboard/manage-courses?tab=published">
          <TabsTrigger
            value="published"
            id="published"
            onClick={() => {
              setFilter("published");
              setActiveTab("published");
              setIsCourseSelected(undefined);
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
              setFilter("draft");
              setActiveTab("draft");
              setIsCourseSelected(undefined);
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
              setActiveTab("bundles");
              setIsCourseSelected(undefined);
            }}
          >
            Bundles
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === "published" && <FilterButton />}
    </div>
  );
};

"use client";

import { TabsList as TabsListUi, TabsTrigger } from "@/components/ui/tabs";
import { CourseTabs } from "@/lib/types/courses.slice.types";
import { Circle, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { FilterButton } from "../../course-management/_components/courses/filter.button";
import { usePostsStore } from "../_lib/posts.slice";
import { PostsFilter, PostsTabs } from "../_lib/posts.slice.types";

export const PostsTabList = () => {
  const { activeTab, setActiveTab, setFilter } = usePostsStore();

  const handleTabClick = useCallback(
    (tab: PostsTabs) => {
      setActiveTab(tab);
      if (activeTab === PostsTabs.Published) setFilter(PostsFilter.Published);
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
        <Link href={`/admin/course-management?tab=${CourseTabs.Published}`}>
          <TabsTrigger
            value={CourseTabs.Published}
            id={CourseTabs.Published}
            onClick={() => handleTabClick(PostsTabs.Published)}
            className={
              activeTab === PostsTabs.Published ? tabClasses.active : tabClasses.Inactive
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
            onClick={() => handleTabClick(PostsTabs.Draft)}
            className={
              activeTab === PostsTabs.Draft ? tabClasses.active : tabClasses.Inactive
            }
          >
            <CircleDashed size={16} />
            Draft
          </TabsTrigger>
        </Link>
      </TabsListUi>
      {activeTab === PostsTabs.Published && <FilterButton />}
    </nav>
  );
};

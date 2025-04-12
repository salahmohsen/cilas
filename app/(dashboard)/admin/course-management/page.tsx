"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { useCallback, useEffect, useRef } from "react";

import { CourseInfo } from "@/app/(dashboard)/admin/course-management/_components/info/info";

import { Tabs } from "@/components/ui/tabs";

import { Button } from "@/components/hoc/button";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, Tab } from "@/lib/types/course.slice.types";
import { Sailboat, Waves } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCourseNavigation } from "../../../../lib/hooks/courses";
import { PageHeader } from "../_components/page.header";
import { CourseInfoModal } from "./_components/info/info.modal";
import { CourseBundles } from "./_components/tabs/bundles.tab";
import { DraftCourses } from "./_components/tabs/draft.tab";
import { CoursesTabList } from "./_components/tabs/list.tab";
import { PublishedCourses } from "./_components/tabs/published.tab";
import { courseNavContext } from "./_context/course.nav.context";

export default function ManageCoursesPage() {
  const { width } = useWindowSize();

  const { activeTab, setActiveTab, setCourseSelected, getCourses, setFilter, filter } =
    useCourseStore();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab;

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useCourseNavigation(containerRef);

  const isDesktop = width && width >= 1024;

  useEffect(() => {
    setActiveTab(tabParam);
  }, [setActiveTab, tabParam]);

  useEffect(() => {
    if (!activeTab) setActiveTab(Tab.Published);
    getCourses();
  }, [getCourses, activeTab, filter, setActiveTab]);

  const onTabChange = useCallback(
    (tab: Tab) => {
      setActiveTab(tab);
      setCourseSelected(null);
      if (tab === Tab.Published) setFilter(CoursesFilter.AllPublished);
      if (tab === Tab.Draft) setFilter(CoursesFilter.Draft);
    },
    [setActiveTab, setCourseSelected, setFilter],
  );
  return (
    <>
      <PageHeader
        title="Course Management"
        description="Manage courses: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
          New Course
        </Button>
        <Button href="/admin/course-management/create-bundle" icon={<Waves />}>
          New Bundle
        </Button>
      </PageHeader>

      <courseNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
        <div className="flex min-h-screen gap-5 overflow-x-clip px-4">
          <div className={cn("w-full")}>
            <Tabs
              value={activeTab as Tab}
              onValueChange={(tab) => onTabChange(tab as Tab)}
              className={cn(`flex flex-col gap-2`)}
            >
              <CoursesTabList />
              <PublishedCourses />
              <DraftCourses />
              <CourseBundles />
            </Tabs>
          </div>
          {isDesktop && (
            <CourseInfo className="sticky top-20 mt-14 max-h-[calc(85vh)]" mode="flex" />
          )}
        </div>
        {!isDesktop && <CourseInfoModal />}
      </courseNavContext.Provider>
    </>
  );
}

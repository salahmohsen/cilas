"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { useCallback, useEffect, useRef } from "react";

import { Tabs } from "@/components/ui/tabs";

import { Button } from "@/components/hoc/button";
import { NotFound } from "@/components/not-found";
import { useItemsNavigation } from "@/lib/hooks/courses";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, CourseTabs } from "@/lib/types/courses.slice.types";
import { Sailboat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "../_components/page.header";
import { ItemsNavContext } from "../_context/items.nav.context";
import { CourseItem } from "./_components/courses/course.item";
import { CourseSkeleton } from "./_components/courses/course.skeleton";
import { CourseInfo } from "./_components/info/info";
import { CourseInfoModal } from "./_components/info/info.modal";
import { CoursesTabList } from "./_components/tabs/list.tab";
import { CourseTabContent } from "./_components/tabs/tab.content";

export default function ManageCoursesPage() {
  const { width } = useWindowSize();

  const {
    courses,
    isLoading,
    activeTab,
    setActiveTab,
    setCourseSelected,
    getCourses,
    setFilter,
    filter,
    courseInfo,
    isCourseSelected,
    setCourseInfo,
  } = useCourseStore();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as CourseTabs;

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useItemsNavigation({
    containerRef,
    itemInfo: courseInfo,
    isItemSelected: isCourseSelected,
    items: courses,
    setItemInfo: setCourseInfo,
    setItemSelected: setCourseSelected,
  });

  const isDesktop = width && width >= 1024;

  useEffect(() => {
    setActiveTab(tabParam);
  }, [setActiveTab, tabParam]);

  useEffect(() => {
    if (!activeTab) setActiveTab(CourseTabs.Published);
    getCourses();
  }, [getCourses, activeTab, filter, setActiveTab]);

  const onTabChange = useCallback(
    (tab: CourseTabs) => {
      setActiveTab(tab);
      setCourseSelected(null);
      if (tab === CourseTabs.Published) setFilter(CoursesFilter.AllPublished);
      if (tab === CourseTabs.Draft) setFilter(CoursesFilter.Draft);
    },
    [setActiveTab, setCourseSelected, setFilter],
  );
  return (
    <div className="flex h-[92vh] flex-col gap-12 p-8">
      <PageHeader
        title="Course Management"
        description="Manage courses: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
          New Course
        </Button>
      </PageHeader>

      <ItemsNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
        <div className="flex gap-8">
          <Tabs
            value={activeTab as CourseTabs}
            onValueChange={(tab) => onTabChange(tab as CourseTabs)}
            className={cn(`flex flex-1 flex-col gap-12`)}
          >
            <CoursesTabList />
            <CourseTabContent
              tabValue={CourseTabs.Published}
              title="Published Courses"
              description="Monitor and manage published courses."
              content={
                <div className="space-y-2">
                  {isLoading && <CourseSkeleton itemsNumber={10} />}
                  {!isLoading &&
                    courses &&
                    courses.length > 0 &&
                    courses.map((course) => (
                      <CourseItem
                        course={course}
                        key={`${course.id}-${course.updatedAt}`}
                      />
                    ))}
                  {courses?.length === 0 && <NotFound message="No Courses Found!" />}
                </div>
              }
            />
            <CourseTabContent
              tabValue={CourseTabs.Draft}
              title="Draft Courses"
              description="Manage and refine courses before publishing."
              content={
                <>
                  {isLoading && <CourseSkeleton itemsNumber={10} />}
                  {!isLoading &&
                    courses &&
                    courses.length > 0 &&
                    courses.map((course) => (
                      <CourseItem
                        course={course}
                        key={`${course.id}-${course.updatedAt}`}
                      />
                    ))}
                  {courses?.length === 0 && <NotFound message="No Drafts Found!" />}
                </>
              }
            />
          </Tabs>
          {isDesktop && (
            <CourseInfo
              className="sticky max-h-[70vh] max-w-1/3 overflow-hidden"
              mode="flex"
            />
          )}
          {!isDesktop && <CourseInfoModal />}
        </div>
      </ItemsNavContext.Provider>
    </div>
  );
}

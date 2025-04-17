"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { useCallback, useEffect, useRef } from "react";

import { CourseInfo } from "@/app/(dashboard)/admin/course-management/_components/info/info";

import { Tabs } from "@/components/ui/tabs";

import { Button } from "@/components/hoc/button";
import { NotFound } from "@/components/not-found";
import { useCourseStore } from "@/lib/store/course.slice";
import { CoursesFilter, Tab } from "@/lib/types/course.slice.types";
import { Sailboat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCourseNavigation } from "../../../../lib/hooks/courses";
import { PageHeader } from "../_components/page.header";
import { CourseItem } from "./_components/courses/course.item";
import { CourseSkeleton } from "./_components/courses/course.skeleton";
import { CourseInfoModal } from "./_components/info/info.modal";
import { CoursesTabList } from "./_components/tabs/list.tab";
import { CourseTabContent } from "./_components/tabs/tab.content";
import { courseNavContext } from "./_context/course.nav.context";

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
  } = useCourseStore();

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
    <div className="flex h-full flex-col gap-12 p-8">
      <PageHeader
        title="Course Management"
        description="Manage courses: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
          New Course
        </Button>
      </PageHeader>

      <courseNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
        <div className="flex gap-8">
          <Tabs
            value={activeTab as Tab}
            onValueChange={(tab) => onTabChange(tab as Tab)}
            className={cn(`flex flex-1 flex-col gap-12`)}
          >
            <CoursesTabList />
            <CourseTabContent
              tabValue={Tab.Published}
              title="Published Courses"
              description="Monitor and manage published courses."
              content={
                <div>
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
              tabValue={Tab.Draft}
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
            <CourseInfo className="sticky max-h-[70vh] max-w-1/3" mode="flex" />
          )}
          {!isDesktop && <CourseInfoModal />}
        </div>
      </courseNavContext.Provider>
    </div>
  );
}

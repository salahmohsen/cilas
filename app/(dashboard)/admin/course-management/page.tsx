"use client";

import { cn } from "@/lib/utils/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { useCallback, useEffect, useRef } from "react";

import { Tabs } from "@/components/ui/tabs";

import { useCourseStore } from "@/app/(dashboard)/admin/course-management/_lib/course.slice";
import {
  CoursesFilter,
  CourseTabs,
} from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import { Button } from "@/components/hoc/button";
import { NotFound } from "@/components/not-found";
import { Sailboat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ItemsNavContext } from "../../_lib/items.nav.context";
import { useItemsNavigation } from "../../_lib/use.items.navigation";
import { InfoModal } from "../_components/info.modal";
import { PageHeader } from "../_components/page.header";
import { CourseItem } from "./_components/courses/course.item";
import { CourseSkeleton } from "./_components/courses/course.skeleton";
import { CourseInfo } from "./_components/info/course.info";
import { CoursesTabList } from "./_components/tabs/course.tabs";
import { CourseTabContent } from "./_components/tabs/course.tabs.content";

export default function ManageCoursesPage() {
  const { width } = useWindowSize();

  const {
    courses,
    isLoading,
    activeTab,
    setActiveTab,
    setSelectedCourse,
    getCourses,
    setFilter,
    courseInfo,
    selectedCourse,
    setCourseInfo,
  } = useCourseStore();

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as CourseTabs | undefined;

  const containerRef = useRef<HTMLUListElement | null>(null);

  const { handleNext, handlePrev } = useItemsNavigation({
    containerRef,
    itemInfo: courseInfo,
    isItemSelected: selectedCourse,
    items: courses,
    setItemInfo: setCourseInfo,
    setItemSelected: setSelectedCourse,
  });

  const isDesktop = width && width >= 1024;

  useEffect(() => {
    setActiveTab(tabParam ?? CourseTabs.Published);
    getCourses();
  }, [getCourses, setActiveTab, tabParam]);

  const onTabChange = useCallback(
    (tab: CourseTabs) => {
      setActiveTab(tab);
      setSelectedCourse(null);
      if (tab === CourseTabs.Published) setFilter(CoursesFilter.AllPublished);
      if (tab === CourseTabs.Draft) setFilter(CoursesFilter.Draft);
    },
    [setActiveTab, setSelectedCourse, setFilter],
  );
  return (
    <ItemsNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
      <div className="flex h-full flex-col gap-12 p-4 md:p-8">
        <PageHeader
          title="Course Management"
          description="Manage courses: create, update, delete, and filter with ease."
        >
          <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
            New Course
          </Button>
        </PageHeader>

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
            >
              <div className="space-y-2">
                {isLoading && <CourseSkeleton itemsNumber={5} />}
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
            </CourseTabContent>
            <CourseTabContent
              tabValue={CourseTabs.Draft}
              title="Draft Courses"
              description="Manage and refine courses before publishing."
            >
              {isLoading && <CourseSkeleton itemsNumber={5} />}
              {!isLoading &&
                courses &&
                courses.length > 0 &&
                courses.map((course) => (
                  <CourseItem course={course} key={`${course.id}-${course.updatedAt}`} />
                ))}
              {courses?.length === 0 && <NotFound message="No Drafts Found!" />}
            </CourseTabContent>
          </Tabs>

          {isDesktop && (
            <CourseInfo
              className="sticky top-10 max-h-[70vh] max-w-1/3 overflow-hidden"
              mode="flex"
            />
          )}
          {!isDesktop && (
            <InfoModal
              type="course"
              info={courseInfo}
              selectedItem={selectedCourse}
              setSelectedItem={setSelectedCourse}
            />
          )}
        </div>
      </div>
    </ItemsNavContext.Provider>
  );
}

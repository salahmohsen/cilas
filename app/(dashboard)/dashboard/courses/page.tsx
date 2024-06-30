"use client";

import { useWindowSize } from "@uidotdev/usehooks";

import Link from "next/link";
import CourseItem from "@/components/dashboard/coursesListPage/CourseItem";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import CourseInfo from "@/components/dashboard/coursesListPage/CourseInfo";
import FilterButton from "@/components/dashboard/coursesListPage/FilterButton";

import { useCourseState } from "@/providers/CourseState.provider";
import CourseInfoModal from "@/components/dashboard/coursesListPage/CourseInfoModal";
import { CourseSkeleton } from "@/components/dashboard/coursesListPage/CourseSkeleton";
import { useSearchParams } from "next/navigation";
import { CoursesFilter } from "@/types/drizzle.types";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState<"published" | "draft">(
    "published",
  );
  const { width } = useWindowSize();

  const { isLoading, courses, setCourseFilter, isSelected } = useCourseState();
  const searchParams = useSearchParams();
  const storedFilter = searchParams.get("publishedFilter") as CoursesFilter;
  const courseMode = searchParams.get("course_mode");
  return (
    <main className={`mx-4 flex flex-col gap-5`}>
      <Card className="col-span-9 flex flex-wrap items-center justify-between gap-5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Cilas Courses</CardTitle>
          <CardDescription className="max-w-lg text-balance leading-relaxed">
            Manage Cilas courses: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex items-center gap-2 p-0">
          <Link href="/dashboard/courses/create-course">
            <Button>New Course</Button>
          </Link>
          <Link href="/dashboard/courses/create-courses-bundle">
            <Button>New Bundle</Button>
          </Link>
        </CardFooter>
      </Card>
      <div className="flex">
        <div
          className={`transition-all duration-500 ease-in-out ${
            width && width <= 768
              ? ""
              : Object.values(isSelected)[0]
                ? "w-[70%]"
                : "w-full"
          }`}
        >
          <Tabs
            defaultValue={courseMode || "published"}
            className={cn(`flex flex-col gap-2`)}
          >
            <div className="flex items-center justify-between">
              <TabsList>
                <Link href="/dashboard/courses?course_mode=published">
                  <TabsTrigger
                    value="published"
                    onClick={() => {
                      setCourseFilter(storedFilter || "all published");
                      setActiveTab("published");
                    }}
                  >
                    Published
                  </TabsTrigger>
                </Link>

                <Link href="/dashboard/courses?course_mode=draft">
                  <TabsTrigger
                    value="draft"
                    onClick={() => {
                      setCourseFilter("draft");
                      setActiveTab("draft");
                    }}
                  >
                    Draft
                  </TabsTrigger>
                </Link>
              </TabsList>
              {activeTab === "published" && <FilterButton />}
            </div>
            <TabsContent value="published">
              <Card>
                <CardHeader className="">
                  <CardTitle>Published Courses</CardTitle>
                  <CardDescription>
                    Monitor and manage published courses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-2">
                    {isLoading && <CourseSkeleton itemsNumber={10} />}
                    {!isLoading &&
                      courses.map((course) => (
                        <CourseItem course={course} key={course.id} />
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="draft">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Draft Courses</CardTitle>
                  <CardDescription>
                    Manage and refine courses before publishing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    {isLoading && <CourseSkeleton itemsNumber={10} />}
                    {!isLoading &&
                      courses.map((course) => (
                        <CourseItem course={course} key={course.id} />
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {width && width >= 1024 && (
          <CourseInfo className="sticky right-0 top-20 mt-14 max-h-[calc(100vh-150px)] overflow-y-auto transition-all duration-500 ease-in-out" />
        )}
      </div>
      {width && width < 1024 && <CourseInfoModal />}
    </main>
  );
}

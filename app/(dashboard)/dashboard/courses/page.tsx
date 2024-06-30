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
    <main
      className={`grid w-full auto-rows-max items-start gap-4 overflow-x-hidden px-4 md:gap-8 md:px-8`}
    >
      <Card className="col-span-3">
        <CardHeader className="pb-3">
          <CardTitle>Cilas Courses</CardTitle>
          <CardDescription className="max-w-lg text-balance leading-relaxed">
            Manage Cilas courses: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-5">
          <Link href="/dashboard/courses/create-course">
            <Button>Create New Course</Button>
          </Link>
          <Link href="/dashboard/courses/create-courses-bundle">
            <Button variant="outline">Create New Course Bundle</Button>
          </Link>
        </CardFooter>
      </Card>
      <div className="col-span-3 flex w-full">
        <Tabs
          defaultValue={courseMode || "published"}
          className={cn(
            `ease-in-out, transition-all duration-300`,
            width && width <= 768
              ? "w-full transition-none"
              : Object.values(isSelected)[0]
                ? "w-[70%]"
                : "w-full",
          )}
        >
          <div className="flex items-center">
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
              <CardHeader className="px-7">
                <CardTitle>Published Courses</CardTitle>
                <CardDescription>
                  Monitor and manage published courses.
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
        {width && width >= 1024 && <CourseInfo />}
        {width && width < 1024 && <CourseInfoModal />}
      </div>
    </main>
  );
}

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

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState<"published" | "draft">(
    "published",
  );
  const { width } = useWindowSize();

  const { isLoading, courses, setCourseFilter } = useCourseState();
  const searchParams = useSearchParams();
  const storedFilter = searchParams.get("publishedFilter") as CoursesFilter;

  return (
    <main className="grid flex-1 items-start gap-4 overflow-x-hidden p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3">
      <div
        className={`grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2`}
      >
        <Card className="sm:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle>Cilas Courses</CardTitle>
            <CardDescription className="max-w-lg text-balance leading-relaxed">
              Introducing Our Dynamic Orders Dashboard for Seamless Management
              and Insightful Analysis.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard/courses/create-course">
              <Button>Create New Course</Button>
            </Link>
          </CardFooter>
        </Card>

        <Tabs defaultValue="published" className="col-span-3 lg:col-span-2">
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger
                value="published"
                id="published"
                onClick={() => {
                  setCourseFilter(storedFilter || "all published");
                  setActiveTab("published");
                }}
              >
                Published Courses
              </TabsTrigger>
              <TabsTrigger
                value="draft"
                id="draft"
                onClick={() => {
                  setCourseFilter("draft");
                  setActiveTab("draft");
                }}
              >
                Draft Courses
              </TabsTrigger>
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
                    courses.map((item) => (
                      <CourseItem item={item} key={item.course.id} />
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
                  {!isLoading &&
                    courses.map((item) => (
                      <CourseItem item={item} key={item.course.id} />
                    ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {width && width >= 1024 && <CourseInfo />}
      {width && width < 1024 && <CourseInfoModal />}
    </main>
  );
}

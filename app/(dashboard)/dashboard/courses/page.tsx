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

import { useCourses } from "@/providers/Courses.provider";
import { CourseStateProvider } from "@/providers/CourseState.provider";
import CourseInfoModal from "@/components/dashboard/coursesListPage/CourseInfoModal";

export default function AdminCourseListPage() {
  const { width } = useWindowSize();
  const { archivedCourses } = useCourses();

  return (
    <CourseStateProvider>
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

          <Tabs defaultValue="current" className="col-span-3 lg:col-span-2">
            <div className="flex items-center">
              <TabsList>
                <TabsTrigger value="current">Current</TabsTrigger>
                <TabsTrigger value="archive">Archived</TabsTrigger>
                <TabsTrigger value="unpublished">Unpublished</TabsTrigger>
              </TabsList>
              <FilterButton />
            </div>
            <TabsContent value="current">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Courses</CardTitle>
                  <CardDescription>Current courses at Cilas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    {/* <CourseItem />
                  <CourseItem /> <CourseItem /> <CourseItem /> <CourseItem />{" "}
                  <CourseItem /> <CourseItem /> */}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="unpublished">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Unpublished Courses</CardTitle>
                  <CardDescription>Upcoming sessions at Cilas.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    <li>test</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="archive">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Courses</CardTitle>
                  <CardDescription>Archived courses.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    {archivedCourses.map((item) => (
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
    </CourseStateProvider>
  );
}

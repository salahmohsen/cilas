"use client";

import { getArchived } from "@/actions/courses.actions";
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

import CourseDetailsPanel from "@/components/dashboard/coursesListPage/CourseDetailsPanel";
import FilterButton from "@/components/dashboard/coursesListPage/FilterButton";
import { useEffect, useState } from "react";
import { z } from "zod";
import { courseSchema } from "@/types/courseForm.schema";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminCourseListPage() {
  const [archivedCourses, setArchivedCourses] = useState<{}[]>([]);
  const [isCourseClicked, setIsCourseClicked] = useState<boolean>(false);
  const [courseData, setCourseData] = useState<typeof getArchived>();
  const { width } = useWindowSize();

  useEffect(() => {
    (async () => {
      const courses = await getArchived();
      setArchivedCourses(courses);
    })();
  }, []);

  return (
    <main className="grid flex-1 items-start gap-4 overflow-x-hidden p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
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

        <Tabs defaultValue="current" className="lg:col-span-2">
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
                  {/* <CourseItem />
                  <CourseItem /> <CourseItem /> <CourseItem /> <CourseItem />{" "}
                  <CourseItem /> <CourseItem /> */}
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
                    <div
                      onClick={() => {
                        setIsCourseClicked((prev) => !prev);
                        setCourseData(item);
                      }}
                      key={item.course.id}
                      className={`sm rounded-md hover:bg-gray-100 ${isCourseClicked ? "bg-gray-100" : "bg-transparent"}`}
                    >
                      <CourseItem item={item} />
                    </div>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      {courseData && width && width >= 1024 && (
        <CourseDetailsPanel
          data={courseData}
          className={`translate-x-96 opacity-0 transition-all duration-300 ease-in-out ${
            isCourseClicked ? "translate-x-0 opacity-100" : ""
          }`}
        />
      )}

      {courseData && width && width < 1024 && (
        <Dialog
          open={isCourseClicked}
          onOpenChange={() => setIsCourseClicked(!isCourseClicked)}
        >
          <DialogContent className="scale-90 p-0">
            <CourseDetailsPanel
              data={courseData}
              className={`h-[90vh] p-0 transition-all duration-300 ease-in-out`}
            />
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}

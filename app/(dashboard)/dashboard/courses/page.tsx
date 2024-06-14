import { getArchived } from "@/actions/CoursesActions";

import CourseItem from "@/components/dashboard/coursesListPage/CourseItem";

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
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AdminCourseListPage() {
  const archivedCourses = await getArchived();

  return (
    <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
      <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
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
              <Button>Create New Order</Button>
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
                    <CourseItem key={item.course.id} item={item} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <CourseDetailsPanel />
    </main>
  );
}

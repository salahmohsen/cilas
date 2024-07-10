import { Suspense } from "react";
import Link from "next/link";
import { getSafeCourses } from "@/actions/courses.actions";
import Loading from "./loading";
import ManageCourses from "@/components/dashboard/manage-courses/main.manage.courses";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sailboat, Waves } from "lucide-react";

export default async function ManageCoursesPage() {
  const courses = await getSafeCourses("published");

  return (
    <Suspense fallback={<Loading />}>
      <main className={`mx-4 flex flex-col gap-5`}>
        <Card className="flex flex-wrap items-end justify-between gap-5 p-6">
          <CardHeader className="p-0">
            <CardTitle>Cilas Courses</CardTitle>
            <CardDescription className="max-w-lg text-balance leading-relaxed">
              Manage Cilas courses: create, update, delete, and filter with ease.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap items-center gap-2 p-0">
            <Link href="/dashboard/manage-courses/create-course">
              <Button>
                <Sailboat className="mr-2 h-4 w-4" />
                New Course
              </Button>
            </Link>
            <Link href="/dashboard/manage-courses/create-bundle">
              <Button>
                <Waves className="mr-2 h-4 w-4" />
                New Bundle
              </Button>
            </Link>
          </CardFooter>
        </Card>
        <ManageCourses courses={courses.courses} />
      </main>
    </Suspense>
  );
}

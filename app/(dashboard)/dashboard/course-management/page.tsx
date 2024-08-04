import Link from "next/link";
import ManageCourses from "@/components/dashboard/course-management/main.manage.courses";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sailboat, Waves } from "lucide-react";

export default async function ManageCoursesPage() {
  return (
    <main className="flex w-full flex-col gap-5 p-5">
      <Card className="flex flex-wrap items-end justify-between gap-5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Course Management</CardTitle>
          <CardDescription className="max-w-lg text-balance leading-relaxed">
            Manage courses: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-2 p-0">
          <Link href="/dashboard/course-management/create-course">
            <Button>
              <Sailboat className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </Link>
          <Link href="/dashboard/course-management/create-bundle">
            <Button>
              <Waves className="mr-2 h-4 w-4" />
              New Bundle
            </Button>
          </Link>
        </CardFooter>
      </Card>
      <ManageCourses />
    </main>
  );
}

import ManageCourses from "@/app/(dashboard)/admin/course-management/_components/courses/manage.courses";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sailboat, Waves } from "lucide-react";
import Link from "next/link";

export default async function ManageCoursesPage() {
  return (
    <main className="flex w-full flex-col gap-5 p-5">
      <Card className="flex flex-wrap items-end justify-between gap-5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Course Management</CardTitle>
          <CardDescription className="max-w-lg leading-relaxed text-balance">
            Manage courses: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-2 p-0">
          <Link href="/admin/course-management/create-course">
            <Button>
              <Sailboat className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </Link>
          <Link href="/admin/course-management/create-bundle">
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

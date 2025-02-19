import ManageCourses from "@/app/(dashboard)/admin/course-management/_components/courses/manage.courses";
import { Button } from "@/components/hoc/button";
import { Sailboat, Waves } from "lucide-react";
import { PageHeader } from "../_components/page.header";

export default async function ManageCoursesPage() {
  return (
    <>
      <PageHeader
        title="Course Management"
        description="Manage courses: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
          New Course
        </Button>
        <Button href="/admin/course-management/create-bundle" icon={<Waves />}>
          New Bundle
        </Button>
      </PageHeader>

      <ManageCourses />
    </>
  );
}

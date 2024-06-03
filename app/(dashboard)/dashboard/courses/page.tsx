import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CourseItem from "@/components/dashboard/CoursesListPage/CourseItem";
import CourseDetailsPanel from "@/components/dashboard/CoursesListPage/CourseDetailsPanel";
import FilterButton from "@/components/dashboard/CoursesListPage/FilterButton";

export default function AdminCourseListPage() {
  return (
    <>
      <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
        <Tabs
          defaultValue="ongoing"
          className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2"
        >
          <div className="flex items-center">
            <TabsList>
              <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
              <TabsTrigger value="archive">Archive</TabsTrigger>
            </TabsList>
            <FilterButton />
          </div>
          <TabsContent value="ongoing">
            <Card>
              <CardHeader className="px-7">
                <CardTitle>Courses</CardTitle>
                <CardDescription>Current courses at Cilas.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>

                      <TableHead className="text-center">Cycle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <CourseItem />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <CourseDetailsPanel />
      </main>
    </>
  );
}

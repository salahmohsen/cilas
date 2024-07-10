"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseState } from "@/providers/CourseState.provider";
import { NoCoursesFound } from "../../notFound";
import { CourseSkeleton } from "../course.skeleton";
import { CourseItem } from "../course.item";

export const DraftTab = () => {
  const { isLoading, optimisticCourses } = useCourseState();

  return (
    <TabsContent value="draft">
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Draft Courses</CardTitle>
          <CardDescription>Manage and refine courses before publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-3">
            {isLoading && <CourseSkeleton itemsNumber={10} />}
            {!isLoading && optimisticCourses?.length === 0 && <NoCoursesFound message="No Drafts Found!" />}
            {!isLoading && optimisticCourses?.map((course) => <CourseItem course={course} key={course.id} />)}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

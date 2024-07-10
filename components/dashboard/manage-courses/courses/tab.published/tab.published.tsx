"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseState } from "@/providers/CourseState.provider";
import { CourseWithSafeFellow } from "@/types/drizzle.types";
import { CourseSkeleton } from "../course.skeleton";
import { CourseItem } from "../course.item";
import { useEffect } from "react";
import { NoCoursesFound } from "../../notFound";

type PublishedTabProps = { courses: CourseWithSafeFellow[] | undefined };

export const PublishedTab = ({ courses }: PublishedTabProps) => {
  const { isLoading, optimisticCourses, setCourses } = useCourseState();

  useEffect(() => {
    if (courses) setCourses(courses);
  }, [courses, setCourses]);

  return (
    <TabsContent value="published">
      <Card>
        <CardHeader className="">
          <CardTitle>Published Courses</CardTitle>
          <CardDescription>Monitor and manage published courses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-2">
            {isLoading && <CourseSkeleton itemsNumber={10} />}
            {!isLoading && optimisticCourses?.map((course) => <CourseItem course={course} key={course.id} />)}
            {!isLoading && optimisticCourses?.length === 0 && <NoCoursesFound message="No Published Courses Found!" />}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

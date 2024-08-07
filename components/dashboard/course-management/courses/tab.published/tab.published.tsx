"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseState } from "@/providers/CourseState.provider";
import { CourseSkeleton } from "../course.skeleton";
import { CourseItem } from "../course.item";
import { NoCoursesFound } from "../../notFound";
import { useContext } from "react";
import { courseNavContext } from "../../main.manage.courses";

export const PublishedTab = () => {
  const {
    state: { isLoading },
    optimisticCourses,
  } = useCourseState();

  const { containerRef } = useContext(courseNavContext);

  return (
    <TabsContent value="published">
      <Card>
        <CardHeader>
          <CardTitle>Published Courses</CardTitle>
          <CardDescription>
            Monitor and manage published courses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-2" ref={containerRef}>
            {isLoading && <CourseSkeleton itemsNumber={10} />}
            {!isLoading &&
              optimisticCourses.length > 0 &&
              optimisticCourses.map((course) => (
                <CourseItem course={course} key={course.id} />
              ))}
            {optimisticCourses.length === 0 && (
              <NoCoursesFound message="No Courses Found!" />
            )}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

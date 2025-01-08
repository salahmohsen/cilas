"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { useContext, useEffect } from "react";
import { courseNavContext } from "../../main.manage.courses";
import { NoCoursesFound } from "../../notFound";
import { CourseItem } from "../course.item";
import { CourseSkeleton } from "../course.skeleton";

export const PublishedTab = () => {
  const { optimisticCourses, isLoading, getCourses, setFilter } =
    useCourseStore();

  useEffect(() => {
    setFilter("published");
    getCourses("published");
  }, [getCourses, setFilter]);

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
                <CourseItem
                  course={course}
                  key={`${course.id}-${course.updatedAt}`}
                />
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

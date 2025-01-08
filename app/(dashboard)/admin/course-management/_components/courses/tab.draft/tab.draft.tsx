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

export const DraftTab = () => {
  const { optimisticCourses, isLoading, getCourses, setFilter } =
    useCourseStore();

  useEffect(() => {
    setFilter("draft");
    getCourses("draft");
  }, [getCourses, setFilter]);

  const { containerRef } = useContext(courseNavContext);

  return (
    <TabsContent value="draft">
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Draft Courses</CardTitle>
          <CardDescription>
            Manage and refine courses before publishing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul
            className="group/list space-y-2 transition-all duration-200 ease-in-out"
            ref={containerRef}
          >
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
              <NoCoursesFound message="No Drafts Found!" />
            )}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

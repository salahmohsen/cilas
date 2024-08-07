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
import { NoCoursesFound } from "../../notFound";
import { CourseSkeleton } from "../course.skeleton";
import { CourseItem } from "../course.item";
import { useContext } from "react";
import { courseNavContext } from "../../main.manage.courses";

export const DraftTab = () => {
  const {
    optimisticCourses,
    state: { isLoading },
  } = useCourseState();

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

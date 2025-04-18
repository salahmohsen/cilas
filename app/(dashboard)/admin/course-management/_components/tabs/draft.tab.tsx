"use client";

import { NotFound } from "@/components/not-found";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { useCourseStore } from "@/lib/store/course.slice";
import { Tab } from "@/lib/types/course.slice.types";
import { useContext } from "react";
import { courseNavContext } from "../../_context/course.nav.context";
import { CourseItem } from "../courses/course.item";
import { CourseSkeleton } from "../courses/course.skeleton";

export const DraftCourses = () => {
  const { courses, isLoading } = useCourseStore();

  const { containerRef } = useContext(courseNavContext);

  return (
    <TabsContent value={Tab.Draft}>
      <Card>
        <CardHeader className="px-7">
          <CardTitle>Draft Courses</CardTitle>
          <CardDescription>Manage and refine courses before publishing.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul
            className="group/list space-y-2 transition-all duration-200 ease-in-out"
            ref={containerRef}
          >
            {isLoading && <CourseSkeleton itemsNumber={10} />}
            {!isLoading &&
              courses &&
              courses.length > 0 &&
              courses.map((course) => (
                <CourseItem course={course} key={`${course.id}-${course.updatedAt}`} />
              ))}
            {courses?.length === 0 && <NotFound message="No Drafts Found!" />}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

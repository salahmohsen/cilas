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
import { Tab } from "@/lib/types/course.slice.types";
import { useContext } from "react";
import { NotFound } from "../../../../../../components/not-found";
import { CourseItem } from "../courses/course.item";
import { CourseSkeleton } from "../courses/course.skeleton";
import { courseNavContext } from "../courses/manage.courses";

export const PublishedTab = () => {
  const { courses, isLoading } = useCourseStore();

  const { containerRef } = useContext(courseNavContext);

  return (
    <TabsContent value={Tab.Published}>
      <Card>
        <CardHeader>
          <CardTitle>Published Courses</CardTitle>
          <CardDescription>Monitor and manage published courses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="group/list space-y-2" ref={containerRef}>
            {isLoading && <CourseSkeleton itemsNumber={10} />}
            {!isLoading &&
              courses &&
              courses.length > 0 &&
              courses.map((course) => (
                <CourseItem course={course} key={`${course.id}-${course.updatedAt}`} />
              ))}
            {courses?.length === 0 && <NotFound message="No Courses Found!" />}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

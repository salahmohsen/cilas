"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Tab } from "@/lib/types/course.slice.types";
import { ReactNode, useContext } from "react";
import { courseNavContext } from "../../_context/course.nav.context";

type CourseTabContentProps = {
  tabValue: Tab;
  title: string;
  description: string;
  content: ReactNode;
};

export const CourseTabContent = ({
  tabValue,
  title,
  description,
  content,
}: CourseTabContentProps) => {
  const { containerRef } = useContext(courseNavContext);

  return (
    <TabsContent value={tabValue}>
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="sr-only">
          <CardTitle>Published Courses</CardTitle>
          <CardDescription>Monitor and manage published courses.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="group/list space-y-2" ref={containerRef}>
            {content}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

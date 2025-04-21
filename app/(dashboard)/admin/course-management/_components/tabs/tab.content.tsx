"use client";

import { useItemsNavContext } from "@/app/(dashboard)/_lib/items.nav.context";
import { CourseTabs } from "@/app/(dashboard)/admin/course-management/_lib/courses.slice.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { ReactNode } from "react";

type CourseTabContentProps = {
  tabValue: CourseTabs;
  title: string;
  description: string;
  children: ReactNode;
};

export const CourseTabContent = ({
  tabValue,
  title,
  description,
  children,
}: CourseTabContentProps) => {
  const { containerRef } = useItemsNavContext();

  return (
    <TabsContent value={tabValue} className="-m-4 rounded-md p-4">
      <Card className="border-0 bg-transparent shadow-none">
        <CardHeader className="sr-only">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="group/list space-y-2" ref={containerRef}>
            {children}
          </ul>
        </CardContent>
      </Card>
    </TabsContent>
  );
};

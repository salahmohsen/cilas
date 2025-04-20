"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { ReactNode } from "react";
import { useItemsNavContext } from "../../_context/items.nav.context";
import { PostsTabs } from "../_lib/posts.slice.types";

type PostsTabContentProps = {
  tabValue: PostsTabs;
  title: string;
  description: string;
  children: ReactNode;
};

export const PostsTabContent = ({
  tabValue,
  title,
  description,
  children,
}: PostsTabContentProps) => {
  const { containerRef } = useItemsNavContext();

  return (
    <TabsContent value={tabValue}>
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

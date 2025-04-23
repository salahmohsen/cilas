import { CourseWithFellowAndStudents } from "@/lib/drizzle/drizzle.types";
import { useCallback, useState } from "react";

type ActiveContentTab = "enContent" | "arContent";
type UseCourseTabProps = { courseData: CourseWithFellowAndStudents | undefined };

export const useCourseTab = ({ courseData }: UseCourseTabProps) => {
  const defaultActiveTab = useCallback((): ActiveContentTab => {
    const arContent = courseData?.arContent?.content?.length ?? 0;
    const enContent = courseData?.enContent?.content?.length ?? 0;
    const defaultTab = arContent > enContent ? "arContent" : "enContent";
    return defaultTab;
  }, [courseData?.arContent, courseData?.enContent]);

  const [activeContentTab, setActiveContentTab] =
    useState<ActiveContentTab>(defaultActiveTab());

  return {
    activeContentTab,
    setActiveContentTab,
  };
};

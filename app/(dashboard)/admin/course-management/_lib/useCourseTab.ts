import { useCallback, useState } from "react";
import { PrivateCourse } from "./courses.actions.types";

type ActiveContentTab = "enContent" | "arContent";
type UseCourseTabProps = { courseData: PrivateCourse | null | undefined };

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

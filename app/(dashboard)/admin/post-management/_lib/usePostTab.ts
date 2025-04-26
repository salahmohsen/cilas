import { useCallback, useState } from "react";
import { Post } from "./posts.actions.type";

type ActiveContentTab = "enContent" | "arContent";
type UsePostTabProps = { post: Post | undefined };

export const usePostTab = ({ post }: UsePostTabProps) => {
  const defaultActiveTab = useCallback((): ActiveContentTab => {
    const arContent = post?.arContent?.content?.length ?? 0;
    const enContent = post?.enContent?.content?.length ?? 0;
    const defaultTab = arContent > enContent ? "arContent" : "enContent";
    return defaultTab;
  }, [post?.arContent, post?.enContent]);

  const [activeContentTab, setActiveContentTab] =
    useState<ActiveContentTab>(defaultActiveTab());

  return {
    activeContentTab,
    setActiveContentTab,
  };
};

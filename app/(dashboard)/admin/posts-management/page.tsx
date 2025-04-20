"use client";

import { Tabs } from "@/components/ui/tabs";

import { usePostsStore } from "@/app/(dashboard)/admin/posts-management/_lib/posts.slice";
import {
  PostsFilter,
  PostsTabs,
} from "@/app/(dashboard)/admin/posts-management/_lib/posts.slice.types";
import { Button } from "@/components/hoc/button";
import { NotFound } from "@/components/not-found";
import { useItemsNavigation } from "@/lib/hooks/courses";
import { cn } from "@/lib/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { Sailboat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { PageHeader } from "../_components/page.header";
import { ItemsNavContext } from "../_context/items.nav.context";
import { CourseSkeleton } from "../course-management/_components/courses/course.skeleton";
import { CourseInfo } from "../course-management/_components/info/info";
import { CourseInfoModal } from "../course-management/_components/info/info.modal";
import { PostItem } from "./_components/post.item";
import { PostsTabContent } from "./_components/tab.content";
import { PostsTabList } from "./_components/tab.list";

export default function BlogManagement() {
  const containerRef = useRef<HTMLUListElement | null>(null);

  const {
    posts,
    isLoading,
    activeTab,
    setActiveTab,
    setPostSelected,
    getPosts,
    setFilter,
    filter,
    postInfo,
    isPostSelected,
    setPostInfo,
  } = usePostsStore();

  const { handleNext, handlePrev } = useItemsNavigation({
    containerRef,
    items: posts,
    itemInfo: postInfo,
    isItemSelected: isPostSelected,
    setItemInfo: setPostInfo,
    setItemSelected: setPostSelected,
  });

  const { width } = useWindowSize();
  const isDesktop = width && width >= 1024;

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as PostsTabs;

  useEffect(() => {
    setActiveTab(tabParam);
  }, [setActiveTab, tabParam]);

  useEffect(() => {
    if (!activeTab) setActiveTab(PostsTabs.Published);
    getPosts();
  }, [getPosts, activeTab, filter, setActiveTab]);

  const onTabChange = useCallback(
    (tab: PostsTabs) => {
      setActiveTab(tab);
      setPostSelected(null);
      if (tab === PostsTabs.Published) setFilter(PostsFilter.Published);
      if (tab === PostsTabs.Draft) setFilter(PostsFilter.Draft);
    },
    [setActiveTab, setPostSelected, setFilter],
  );

  console.log(posts);

  return (
    <div className="flex h-[100vh] flex-col gap-12 p-8">
      <PageHeader
        title="Course Management"
        description="Manage courses: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-course" icon={<Sailboat />}>
          New Course
        </Button>
      </PageHeader>

      <ItemsNavContext.Provider value={{ handleNext, handlePrev, containerRef }}>
        <div className="flex gap-8">
          <Tabs
            value={activeTab as PostsTabs}
            onValueChange={(tab) => onTabChange(tab as PostsTabs)}
            className={cn(`flex flex-1 flex-col gap-12`)}
          >
            <PostsTabList />
            <PostsTabContent
              tabValue={PostsTabs.Published}
              title="Published Posts"
              description="Monitor and manage published posts."
            >
              {isLoading && <CourseSkeleton itemsNumber={10} />}
              {!isLoading &&
                posts &&
                posts.length > 0 &&
                posts.map((post) => (
                  <PostItem post={post} key={`${post.id}-${post.updatedAt}`} />
                ))}
              {posts?.length === 0 && <NotFound message="No Courses Found!" />}
            </PostsTabContent>
            <PostsTabContent
              tabValue={PostsTabs.Draft}
              title="Draft Posts"
              description="Monitor and manage draft posts."
            >
              {isLoading && <CourseSkeleton itemsNumber={10} />}
              {!isLoading &&
                posts &&
                posts.length > 0 &&
                posts.map((post) => (
                  <PostItem post={post} key={`${post.id}-${post.updatedAt}`} />
                ))}
              {posts?.length === 0 && <NotFound message="No Courses Found!" />}
            </PostsTabContent>
          </Tabs>
          {isDesktop && (
            <CourseInfo className="sticky max-h-[70vh] max-w-1/3" mode="flex" />
          )}
          {!isDesktop && <CourseInfoModal />}
        </div>
      </ItemsNavContext.Provider>
    </div>
  );
}

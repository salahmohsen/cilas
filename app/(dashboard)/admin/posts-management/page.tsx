"use client";

import { Tabs } from "@/components/ui/tabs";

import { usePostsStore } from "@/app/(dashboard)/admin/posts-management/_lib/posts.slice";
import {
  PostsFilter,
  PostsTabs,
} from "@/app/(dashboard)/admin/posts-management/_lib/posts.slice.types";
import { Button } from "@/components/hoc/button";
import { NotFound } from "@/components/not-found";
import { cn } from "@/lib/utils";
import { useWindowSize } from "@uidotdev/usehooks";
import { Sailboat } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { TabContentSheet } from "../../_components/tab.content.sheet";
import { ItemsNavContext } from "../../_lib/items.nav.context";
import { useItemsNavigation } from "../../_lib/use.items.navigation";
import { InfoModal } from "../_components/info.modal";
import { PageHeader } from "../_components/page.header";
import { CourseSkeleton } from "../course-management/_components/courses/course.skeleton";
import { PostInfo } from "./_components/post.info";
import { PostItem } from "./_components/post.item";
import { PostsTabList } from "./_components/post.tabs";

export default function BlogManagement() {
  const containerRef = useRef<HTMLUListElement | null>(null);

  const {
    posts,
    isLoading,
    activeTab,
    setActiveTab,
    setSelectedPost,
    getPosts,
    setFilter,
    filter,
    postInfo,
    selectedPost,
    setPostInfo,
  } = usePostsStore();

  const { handleNext, handlePrev } = useItemsNavigation({
    containerRef,
    items: posts,
    itemInfo: postInfo,
    isItemSelected: selectedPost,
    setItemInfo: setPostInfo,
    setItemSelected: setSelectedPost,
  });

  const { width } = useWindowSize();
  const isDesktop = width && width >= 1024;

  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as PostsTabs | undefined;

  useEffect(() => {
    setActiveTab(tabParam ?? PostsTabs.Published);
    getPosts();
  }, [getPosts, setActiveTab, tabParam]);

  const onTabChange = useCallback(
    (tab: PostsTabs) => {
      setActiveTab(tab);
      setSelectedPost(null);
      if (tab === PostsTabs.Published) setFilter(PostsFilter.Published);
      if (tab === PostsTabs.Draft) setFilter(PostsFilter.Draft);
    },
    [setActiveTab, setSelectedPost, setFilter],
  );

  return (
    <div className="relative flex h-[100vh] flex-1 flex-col gap-12 p-8">
      <PageHeader
        title="Posts Management"
        description="Manage posts: create, update, delete, and filter with ease."
      >
        <Button href="/admin/course-management/create-post" icon={<Sailboat />}>
          New Post
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
            <TabContentSheet
              tabValue={PostsTabs.Published}
              title="Published Posts"
              description="Monitor and manage published posts."
            >
              {isLoading && <CourseSkeleton itemsNumber={5} />}
              {!isLoading &&
                posts &&
                posts.length > 0 &&
                posts.map((post) => (
                  <PostItem post={post} key={`${post.id}-${post.updatedAt}`} />
                ))}
              {posts?.length === 0 && <NotFound message="No Posts Found!" />}
            </TabContentSheet>
            <TabContentSheet
              tabValue={PostsTabs.Draft}
              title="Draft Posts"
              description="Monitor and manage draft posts."
            >
              {isLoading && <CourseSkeleton itemsNumber={5} />}
              {!isLoading &&
                posts &&
                posts.length > 0 &&
                posts.map((post) => (
                  <PostItem post={post} key={`${post.id}-${post.updatedAt}`} />
                ))}
              {posts?.length === 0 && <NotFound message="No Posts Found!" />}
            </TabContentSheet>
          </Tabs>
          {isDesktop && (
            <PostInfo className="sticky max-h-[70vh] max-w-1/3" mode="flex" />
          )}
          {!isDesktop && (
            <InfoModal
              type="post"
              info={postInfo}
              selectedItem={selectedPost}
              setSelectedItem={setSelectedPost}
            />
          )}
        </div>
      </ItemsNavContext.Provider>
    </div>
  );
}

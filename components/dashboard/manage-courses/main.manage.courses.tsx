"use client";

import { cn } from "@/lib/utils";
import { useCourseState } from "@/providers/CourseState.provider";
import { useWindowSize } from "@uidotdev/usehooks";

import { CourseInfo } from "@/components/dashboard/manage-courses/info/info";
import { CourseInfoModal } from "@/components/dashboard/manage-courses/info/info.modal";

import { Tabs } from "@/components/ui/tabs";

import { DraftTab } from "./courses/tab.draft/tab.draft";
import { BundlesTab } from "./tab.bundles/tab.bundles";
import { PublishedTab } from "./courses/tab.published/tab.published";
import { TabsList } from "./tab.list";
import { Tab } from "@/types/manage.courses.types";
import { useSearchParams } from "next/navigation";

export default function ManageCourses() {
  const searchParams = useSearchParams();
  const openedTab = searchParams?.get("tab");

  const { width } = useWindowSize();

  const {
    state: { isCourseSelected, activeTab },
    dispatch,
  } = useCourseState();
  return (
    <div>
      <div className="flex">
        <div
          className={cn(
            "w-full transition-all duration-500 ease-in-out",
            width &&
              width >= 1024 &&
              (Object.values(isCourseSelected ?? {})[0] ? "w-[70%]" : "w-full"),
          )}
        >
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              dispatch({
                type: "SET_ACTIVE_TAB",
                payload: value as Tab,
              })
            }
            className={cn(`flex flex-col gap-2`)}
          >
            <TabsList />
            <PublishedTab />
            <DraftTab />
            <BundlesTab />
          </Tabs>
        </div>

        {width && width >= 1024 && (
          <CourseInfo className="sticky right-0 top-20 mt-14 max-h-[calc(100vh-150px)] overflow-y-auto transition-all duration-500 ease-in-out" />
        )}
      </div>
      {width && width < 1024 && <CourseInfoModal />}
    </div>
  );
}

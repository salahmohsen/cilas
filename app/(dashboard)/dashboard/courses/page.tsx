"use client";

import { useFormState } from "react-dom";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWindowSize } from "@uidotdev/usehooks";
import { useCourseState } from "@/providers/CourseState.provider";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteCourse } from "@/actions/courses.actions";

import { CourseItem } from "@/components/dashboard/page.courses/page.courses.item";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseInfo } from "@/components/dashboard/page.courses/page.courses.info";
import { FilterButton } from "@/components/dashboard/page.courses/page.courses.button.filter";
import { CourseInfoModal } from "@/components/dashboard/page.courses/page.courses.info.modal";
import { CourseSkeleton } from "@/components/dashboard/page.courses/page.courses.skeleton";
import { CoursesFilter } from "@/types/drizzle.types";
import { BundleItem } from "@/components/dashboard/page.courses/page.courses.tab.bundles";
import { Loader, LoaderPinwheel, Sailboat, Waves } from "lucide-react";

export default function CoursesPage() {
  const [activeTab, setActiveTab] = useState<"published" | "draft">(
    "published",
  );
  const { width } = useWindowSize();

  const {
    isLoading,
    setFilter,
    isCourseSelected: isSelected,
    setIsCourseSelected: setIsSelected,
    courses,
    setCourses,
    bundles,
  } = useCourseState();

  const searchParams = useSearchParams();
  const storedFilter = searchParams?.get("publishedFilter") as CoursesFilter;
  const courseMode = searchParams?.get("course_mode");

  // Delete Course
  const [deleteState, deleteAction] = useFormState(deleteCourse, {});
  const [isPending, startTransition] = useTransition();

  const [optimisticCourses, addOptimisticCourse] = useOptimistic(
    courses,
    (currentState, courseIdToRemove: number) => {
      if (currentState)
        return currentState.filter((course) => course.id !== courseIdToRemove);
    },
  );

  const handleDelete = useCallback(
    (courseId: number) => {
      startTransition(() => {
        addOptimisticCourse(courseId);
        const formData = new FormData();
        formData.append("courseId", courseId.toString());
        deleteAction(formData);
      });
    },
    [addOptimisticCourse, deleteAction],
  );
  const toastId = useRef<string | number>();
  useEffect(() => {
    if (isPending) toastId.current = toast.loading("Loading...");
  }, [isPending]);

  useEffect(() => {
    if (deleteState?.success) {
      toast.success(deleteState.message, { id: toastId.current });
      setCourses((current) =>
        current?.filter(
          (course) => course.id !== Number(deleteState?.deletedId),
        ),
      );
    }
    if (deleteState?.error) toast.error(deleteState.message);
  }, [deleteState, setCourses, toastId]);

  return (
    <main className={`mx-4 flex flex-col gap-5`}>
      <Card className="flex flex-wrap items-end justify-between gap-5 p-6">
        <CardHeader className="p-0">
          <CardTitle>Cilas Courses</CardTitle>
          <CardDescription className="max-w-lg text-balance leading-relaxed">
            Manage Cilas courses: create, update, delete, and filter with ease.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-wrap items-center gap-2 p-0">
          <Link href="/dashboard/courses/create-course">
            <Button>
              <Sailboat className="mr-2 h-4 w-4" />
              New Course
            </Button>
          </Link>
          <Link href="/dashboard/courses/create-bundle">
            <Button>
              <Waves className="mr-2 h-4 w-4" />
              New Bundle
            </Button>
          </Link>
        </CardFooter>
      </Card>
      <div className="flex">
        <div
          className={`transition-all duration-500 ease-in-out ${
            width && width <= 768
              ? ""
              : Object.values(isSelected)[0]
                ? "w-[70%]"
                : "w-full"
          }`}
        >
          <Tabs
            defaultValue={courseMode || "published"}
            className={cn(`flex flex-col gap-2`)}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <Link href="/dashboard/courses?course_mode=published">
                  <TabsTrigger
                    value="published"
                    onClick={() => {
                      setFilter(storedFilter || "published");
                      setActiveTab("published");
                      setIsSelected(() => ({ key: false }));
                    }}
                  >
                    Published
                  </TabsTrigger>
                </Link>

                <Link href="/dashboard/courses?course_mode=draft">
                  <TabsTrigger
                    value="draft"
                    onClick={() => {
                      setFilter("draft");
                      setActiveTab("draft");
                      setIsSelected(() => ({ key: false }));
                    }}
                  >
                    Draft
                  </TabsTrigger>
                </Link>

                <Link href="/dashboard/courses?course_mode=bundles">
                  <TabsTrigger
                    value="bundles"
                    onClick={() => {
                      setFilter("bundles");
                      setIsSelected(() => ({ key: false }));
                    }}
                  >
                    Bundles
                  </TabsTrigger>
                </Link>
              </TabsList>
              {activeTab === "published" && <FilterButton />}
            </div>
            <TabsContent value="published">
              <Card>
                <CardHeader className="">
                  <CardTitle>Published Courses</CardTitle>
                  <CardDescription>
                    Monitor and manage published courses.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-2">
                    {isLoading && <CourseSkeleton itemsNumber={10} />}
                    {!isLoading &&
                      optimisticCourses?.map((course) => (
                        <CourseItem
                          course={course}
                          key={course.id}
                          handleDelete={handleDelete}
                        />
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="draft">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Draft Courses</CardTitle>
                  <CardDescription>
                    Manage and refine courses before publishing.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    {isLoading && <CourseSkeleton itemsNumber={10} />}
                    {!isLoading &&
                      optimisticCourses?.map((course) => (
                        <CourseItem
                          course={course}
                          key={course.id}
                          handleDelete={handleDelete}
                        />
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="bundles">
              <Card>
                <CardHeader className="px-7">
                  <CardTitle>Courses Bundles</CardTitle>
                  <CardDescription>Manage courses bundles.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="group/list space-y-3">
                    {bundles.map((bundle) => (
                      <BundleItem key={bundle.id} bundle={{ ...bundle }} />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {width && width >= 1024 && (
          <CourseInfo className="sticky right-0 top-20 mt-14 max-h-[calc(100vh-150px)] overflow-y-auto transition-all duration-500 ease-in-out" />
        )}
      </div>
      {width && width < 1024 && <CourseInfoModal />}
    </main>
  );
}

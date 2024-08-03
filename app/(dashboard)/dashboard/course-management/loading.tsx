import { CourseSkeleton } from "@/components/dashboard/course-management/courses/course.skeleton";
import { Skeleton } from "@/components/ui";

const Loading = () => {
  return (
    <main className={`mx-4 mb-10 max-h-[calc(100%-150px)]`}>
      <div className="flex w-full flex-col gap-5 rounded-md border p-6">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
      </div>
      <div className="my-5 flex items-center justify-between gap-5">
        <Skeleton className="h-8 w-1/3 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      <div className="w-full rounded-md border p-5">
        <div>
          <div className={"flex flex-col gap-2"}>
            <ul className="space-y-2">
              <CourseSkeleton itemsNumber={10} />
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Loading;

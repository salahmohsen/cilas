import { Skeleton } from "@/components/ui/skeleton";

export function CourseSkeleton({ itemsNumber }: { itemsNumber: number }) {
  const skeletonArr = Array(itemsNumber).fill("course");

  return (
    <ul>
      {skeletonArr.map((_, index) => (
        <li
          key={index}
          className={`mb-5 flex items-center justify-between gap-2 rounded-md border px-5 py-6`}
        >
          <div className="flex w-full flex-col gap-3">
            <div className="flex h-5 gap-1">
              <Skeleton className="w-1/5 rounded-full" />
            </div>
            <div className="flex h-5 gap-2">
              <Skeleton className="w-1/12" />
              <Skeleton className="mr-10 w-2/3" />
            </div>
            <div className="flex h-5 gap-1">
              <Skeleton className="w-5 rounded-full" />
              <Skeleton className="w-24 rounded-md" />
            </div>
          </div>
          <div>
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  );
}

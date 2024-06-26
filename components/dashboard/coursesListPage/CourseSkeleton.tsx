import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, User } from "lucide-react";

export function CourseSkeleton({ itemsNumber }) {
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
              <Skeleton className="w-5 rounded-full" />
              <Skeleton className="w-24 rounded-md" />
            </div>
            <div className="flex h-5 gap-2">
              <Skeleton className="w-16" />
              <Skeleton className="mr-10 w-full" />
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

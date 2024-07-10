import { Skeleton } from "@/components/ui/skeleton";

export const BundleSkeleton = ({ itemsNumber }: { itemsNumber: number }) => {
  const skeletonArr = Array(itemsNumber).fill("bundle");
  return (
    <ul>
      {skeletonArr.map((_, index) => (
        <li className="mb-5 rounded-md border p-5" key={index}>
          <div className="flex flex-col gap-4">
            <div className={`flex flex-col gap-2 pr-12 text-xs font-light lg:flex-row lg:pr-0`}>
              <Skeleton className={"h-5 w-28 rounded-md"} />
              <Skeleton className={"h-5 w-28 rounded-md"} />
              <Skeleton className={"h-5 w-28 rounded-md"} />
            </div>
            <div>
              <ul className="space-y-3">
                <Skeleton className={"h-5 w-[90%] rounded-md"} />
                <Skeleton className={"h-5 w-[70%] rounded-md"} />
                <Skeleton className={"h-5 w-[80%] rounded-md"} />
              </ul>
            </div>
            <div className="flex w-full gap-1 border-t-2 border-foreground/5 pt-4 text-xs font-light">
              <Skeleton className={"h-5 w-5 rounded-md"} />
              <Skeleton className={"h-5 w-48 rounded-md"} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

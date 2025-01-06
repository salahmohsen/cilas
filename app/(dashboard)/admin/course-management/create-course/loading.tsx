import { Skeleton } from "@/components/ui/skeleton";

const Loading = () => {
  return (
    <div className="h-[calc(100vh-4rem)] w-full overflow-y-hidden">
      {/* Header */}
      <div className="flex h-16 w-full items-center justify-between border-b px-4 py-2 sm:px-8">
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-4 w-24 rounded-md" />
        </div>
        <div className="flex w-full items-center justify-end gap-2 md:max-w-max md:justify-center">
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-md" />
        </div>
      </div>
      <div className="flex">
        {/* Content */}
        <div className="flex w-full flex-col sm:w-2/3">
          <div className="flex h-10 w-full items-center justify-center gap-2 bg-muted/50">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="mt-6 w-full space-y-5 px-6 lg:px-36">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </div>
        {/* Sidebar */}
        <div className="hidden h-full w-full border-l sm:w-1/3 md:block">
          <div className="flex h-10 w-full items-center justify-center gap-2 bg-muted/50 px-5">
            <Skeleton className="h-8 w-32"></Skeleton>
            <Skeleton className="h-8 w-32"></Skeleton>
          </div>
          <div className="space-y-8 p-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <div className="w-full space-y-2" key={index}>
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Loading;

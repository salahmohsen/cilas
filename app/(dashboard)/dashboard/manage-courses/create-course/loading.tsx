import { Skeleton } from "@/components/ui/skeleton";

const Loading = () => {
  return (
    <main className="mx-0 xl:mx-32">
      <div className="grid w-full items-start gap-10">
        <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
          <legend className="-ml-1 px-1 text-sm font-medium">
            Course Content
          </legend>
          <div className="flex flex-col gap-5">
            <div className="flex gap-5">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <Skeleton className="h-10 w-full rounded-md" />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap justify-center gap-2 rounded-md">
                {Array(9)
                  .fill("tool")
                  .map((_, index) => (
                    <Skeleton className="h-7 w-7 rounded-md" key={index} />
                  ))}
              </div>
              <Skeleton className="h-44 w-full rounded-md" />
            </div>
          </div>
        </fieldset>
        <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm">
          <legend className="-ml-1 px-1 text-sm font-medium">
            Course Metadata
          </legend>
          <div className="grid justify-center gap-10 lg:grid-cols-2">
            {Array(12)
              .fill("tool")
              .map((_, index) => (
                <Skeleton className="h-10 w-full rounded-md" key={index} />
              ))}
          </div>
        </fieldset>

        <div className="-mt-3 mb-5 flex gap-5">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    </main>
  );
};

export default Loading;

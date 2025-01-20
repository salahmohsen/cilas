import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-5 mb-5 space-y-5">
      <fieldset className="grid gap-6 rounded-lg border p-4 shadow-sm lg:grid-cols-2">
        <legend className="text-sm font-medium">Bundle</legend>

        {Array(6)
          .fill("tool")
          .map((_, index) => (
            <Skeleton className="h-10 w-full rounded-md" key={index} />
          ))}
      </fieldset>
      <Skeleton className="h-10 w-full rounded-md" />
    </div>
  );
}

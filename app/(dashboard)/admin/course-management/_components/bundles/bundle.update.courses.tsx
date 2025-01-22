import { updateBundleCourses } from "@/lib/actions/bundles.actions";
import { getUnbundledCourses } from "@/lib/actions/courses.actions";
import { Dispatch, SetStateAction, useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MultipleSelector, Option } from "@/components/ui/multipleSelector";

import { useCourseStore } from "@/lib/store/course.slice";
import { LoaderPinwheel } from "lucide-react";
import { toast } from "sonner";

export const UpdateCourses = ({
  bundleId,
  setIsOptionsMenuOpen,
}: {
  bundleId: number;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { bundles, getBundles } = useCourseStore();

  const bundle = bundles?.find((bundle) => bundle.id === bundleId);

  const defaultCourses: Option[] | undefined = bundle?.courses.map((course) => ({
    value: course.id.toString(),
    label: (course.enTitle || course.arTitle) as string,
  }));

  const [courses, setCourses] = useState<Option[] | undefined>(defaultCourses);
  const [loading, setLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  const handleUpdateBundleCourses = useCallback(async () => {
    if (courses) {
      try {
        setLoading(true);
        const results = await updateBundleCourses(courses, bundleId);
        if (results.error) throw new Error(results.message);
        if (results.success) {
          toast.success(results.message);
          getBundles();
          setIsOptionsMenuOpen(false);
          setDialogOpen(false);
        }
      } catch (e) {
        toast.error(e instanceof Error && e.message);
      } finally {
        setLoading(false);
      }
    }
  }, [courses, bundleId, setIsOptionsMenuOpen, getBundles]);

  const selector = (
    <MultipleSelector
      className="overflow-y-auto"
      value={courses}
      delay={300}
      onChange={setCourses}
      triggerSearchOnFocus
      commandProps={{
        className: "max-h-28 ",
      }}
      onSearch={(query) => getUnbundledCourses(query, defaultCourses)}
      placeholder="Search for unbundled courses..."
      hidePlaceholderWhenSelected
      badgeClassName="rounded-sm"
      disabled={loading}
      emptyIndicator={
        <p className="flex h-auto w-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
          <span>No courses Found</span>
          <span>start typing to search...</span>
        </p>
      }
    />
  );

  if (!bundle) return toast.error("Something went wrong, bundle is not available!");

  return (
    <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
      <DialogTrigger>Edit Courses</DialogTrigger>
      <DialogContent>
        <DialogHeader className="border-0">
          <DialogTitle>Edit Bundle Courses</DialogTitle>
        </DialogHeader>
        {selector}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleUpdateBundleCourses} disabled={loading}>
            {loading ? (
              <span className="flex gap-2">
                <LoaderPinwheel className="animate-spin" /> Save Changes
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

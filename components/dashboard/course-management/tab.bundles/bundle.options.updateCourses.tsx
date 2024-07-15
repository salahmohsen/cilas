import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { getUnbundledCourses } from "@/actions/courses.actions";
import { updateBundleCourses } from "@/actions/bundles.actions";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import MultipleSelector, { Option } from "@/components/ui/multipleSelector";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DialogClose } from "@radix-ui/react-dialog";
import { LoaderPinwheel } from "lucide-react";
import { useCourseState } from "@/providers/CourseState.provider";

export const UpdateCourses = ({
  bundleId,
  setIsOptionsMenuOpen,
}: {
  bundleId: number;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const {
    forceUpdateBundles,

    state: { bundles },
  } = useCourseState();

  const bundle = bundles.find((bundle) => bundle.id === bundleId);

  const defaultCourses: Option[] | undefined = bundle?.courses.map(
    (course) => ({
      value: course.id.toString(),
      label: (course.enTitle || course.arTitle) as string,
    }),
  );

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
          forceUpdateBundles();
          setIsOptionsMenuOpen(false);
          setDialogOpen(false);
        }
      } catch (e) {
        toast.error(e instanceof Error && e.message);
      } finally {
        setLoading(false);
      }
    }
  }, [courses, bundleId, setIsOptionsMenuOpen, forceUpdateBundles]);

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

  if (!bundle)
    return toast.error("Something went wrong, bundle is not available!");

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

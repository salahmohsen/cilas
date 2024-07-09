import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getUnbundledCourses } from "@/actions/courses.actions";
import { Bundle, updateBundleCourses } from "@/actions/bundles.actions";
import { useWindowSize } from "@uidotdev/usehooks";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import MultipleSelector, { Option } from "@/components/ui/multipleSelector";
import { Button } from "@/components/ui/button";
import { useBundle } from "./item.bundle";
import { toast } from "sonner";
import { DialogClose } from "@radix-ui/react-dialog";
import { LoaderPinwheel } from "lucide-react";
import { useCourseState } from "@/providers/CourseState.provider";

export const UpdateCourses = () => {
  const { bundle, setIsOptionsMenuOpen } = useBundle();
  const { forceUpdateBundles } = useCourseState();
  const { width } = useWindowSize();

  const defaultCourses: Option[] = bundle.courses.map((course) => ({
    value: course.id.toString(),
    label: (course.enTitle || course.arTitle) as string,
  }));

  const [courses, setCourses] = useState<Option[]>(defaultCourses);
  const [loading, setLoading] = useState<boolean>(false);
  const [dialogDrawerOpen, setDialogDrawerOpen] = useState<boolean>(false);
  const selector = (
    <MultipleSelector
      className="overflow-y-auto"
      value={courses}
      delay={300}
      onChange={setCourses}
      triggerSearchOnFocus
      onSearch={(query) => getUnbundledCourses(query, defaultCourses)}
      placeholder="Search for unbundled courses..."
      hidePlaceholderWhenSelected
      badgeClassName="rounded-sm"
      disabled={loading}
      emptyIndicator={
        <p className="flex w-full items-center justify-center text-sm leading-10 text-muted-foreground">
          No Courses found!
        </p>
      }
    />
  );

  const handleUpdateBundleCourses = useCallback(async () => {
    try {
      setLoading(true);
      const results = await updateBundleCourses(courses, bundle.id);
      if (results.error) throw new Error(results.message);
      if (results.success) {
        toast.success(results.message);
        forceUpdateBundles();
        setDialogDrawerOpen(false);
        setIsOptionsMenuOpen(false);
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message);
    } finally {
      setLoading(false);
    }
  }, [bundle.id, courses, forceUpdateBundles, setIsOptionsMenuOpen]);

  if (width && width > 768)
    return (
      <Dialog onOpenChange={setDialogDrawerOpen} open={dialogDrawerOpen}>
        <DialogTrigger>Update Courses</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Courses</DialogTitle>
            <DialogDescription>Start typing to search</DialogDescription>
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

  return (
    <Drawer onOpenChange={setDialogDrawerOpen} open={dialogDrawerOpen}>
      <DrawerTrigger>Update Courses</DrawerTrigger>
      <DrawerContent className="h-[50vh]">
        <DrawerHeader className="p-0 px-4 pb-0">
          <DrawerTitle>Update Bundle Courses</DrawerTitle>
          <DrawerDescription>Start typing to search</DrawerDescription>
        </DrawerHeader>
        {selector}
        <DrawerFooter>
          <Button onClick={handleUpdateBundleCourses} disabled={loading}>
            {loading ? (
              <span className="flex gap-2">
                <LoaderPinwheel className="animate-spin" /> Save Changes
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Cancel
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
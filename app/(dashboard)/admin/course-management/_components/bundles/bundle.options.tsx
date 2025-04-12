import Link from "next/link";
import React, { Dispatch, SetStateAction, useCallback } from "react";

import { Button } from "@/components/hoc/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";

import { deleteBundle } from "@/lib/actions/bundles.actions";
import { useCourseStore } from "@/lib/store/course.slice";
import { useWindowSize } from "@uidotdev/usehooks";
import { toast } from "sonner";
import { UpdateCourses } from "./bundle.update.courses";

export const BundleOptions = ({
  bundleId,
  isOptionsMenuOpen,
  setIsOptionsMenuOpen,
}: {
  bundleId: number;
  isOptionsMenuOpen: boolean;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { getBundles } = useCourseStore();
  const { width } = useWindowSize();
  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOptionsMenuOpen(false);
      const toastId = toast.loading("Deleting...");
      try {
        const result = await deleteBundle(bundleId);
        if (result.error) throw new Error(result.message);
        if (result.success) {
          toast.success(result.message, { id: toastId });
          getBundles();
        }
      } catch (e) {
        toast.error(e instanceof Error && e.message, { id: toastId });
      } finally {
      }
    },
    [setIsOptionsMenuOpen, bundleId, getBundles],
  );

  return (
    <DropdownMenu onOpenChange={setIsOptionsMenuOpen} open={isOptionsMenuOpen}>
      <DropdownMenuTrigger
        asChild
        className={`invisible absolute right-5 group-hover/item:visible ${width && width < 769 && "visible"} ${isOptionsMenuOpen && "visible"} `}
      >
        <Button
          size="icon"
          variant="outline"
          className={`bg-background text-foreground h-8 w-8`}
        >
          <Ellipsis className="h-3.5 w-3.5" />
          <span className="sr-only">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link
          href={`/admin/course-management/edit-bundle?id=${bundleId}`}
          >
          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
            Edit Bundle
          </DropdownMenuItem>
        </Link>

        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <UpdateCourses
            bundleId={bundleId}
            setIsOptionsMenuOpen={setIsOptionsMenuOpen}
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onClick={handleDelete}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

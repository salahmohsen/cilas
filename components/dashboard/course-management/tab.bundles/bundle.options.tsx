import React, { Dispatch, SetStateAction, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import {
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis } from "lucide-react";

import { UpdateCourses } from "./bundle.options.updateCourses";
import { useWindowSize } from "@uidotdev/usehooks";
import { deleteBundle } from "@/actions/bundles.actions";
import { useCourseState } from "@/providers/CourseState.provider";
import { toast } from "sonner";

export const BundleOptions = ({
  bundleId,
  isOptionsMenuOpen,
  setIsOptionsMenuOpen,
}: {
  bundleId: number;
  isOptionsMenuOpen: boolean;
  setIsOptionsMenuOpen: Dispatch<SetStateAction<boolean>>;
}) => {
  const { forceUpdateBundles } = useCourseState();
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
          forceUpdateBundles();
        }
      } catch (e) {
        toast.error(e instanceof Error && e.message, { id: toastId });
      } finally {
      }
    },
    [setIsOptionsMenuOpen, bundleId, forceUpdateBundles],
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
          className={`h-8 w-8 bg-background text-foreground`}
        >
          <Ellipsis className="h-3.5 w-3.5" />
          <span className="sr-only">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Link href={`/dashboard/course-management/edit-bundle?id=${bundleId}`}>
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

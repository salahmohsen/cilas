"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { LoaderPinwheel } from "lucide-react";
import { cn } from "@/lib/utils";

export const SubmitButton = ({
  className,
  isLoading,
  editMode,
}: {
  className?: string;
  isLoading: boolean;
  editMode: boolean;
}) => {
  const { pending } = useFormStatus(); // Unknown issue make useFormStatus doesn't work
  return (
    <Button
      type="submit"
      disabled={pending || isLoading}
      className={cn("w-full", className)}
    >
      {pending || isLoading ? (
        <LoaderPinwheel className="animate-spin" />
      ) : editMode ? (
        "Edit Course"
      ) : (
        "Create Course"
      )}
    </Button>
  );
};

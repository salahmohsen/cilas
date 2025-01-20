"use client";

import { Button } from "@/components/ui/button";
import { LoaderPinwheel } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import React, { forwardRef } from "react";

type SubmitButtonProps = {
  className?: string;
  isLoading?: boolean;
  value: string;
  variant?: "default" | "secondary";
  handleOnClick?: () => void;
};

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ className, isLoading, value, variant, handleOnClick }, ref) => {
    return (
      <Button
        type="submit"
        disabled={isLoading}
        className={cn("submit-btn w-full", className)}
        variant={variant}
        size={"sm"}
        name={value}
        onClick={handleOnClick}
        ref={ref}
      >
        {isLoading ? (
          <span className="flex gap-2">
            <LoaderPinwheel className="animate-spin" /> {value}
          </span>
        ) : (
          value
        )}
      </Button>
    );
  },
);

SubmitButton.displayName = "SubmitButton";

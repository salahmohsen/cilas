"use client";

import { Button } from "@/components/ui/button";
import { LoaderPinwheel } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type SubmitButtonProps = {
  className?: string;
  isLoading?: boolean;
  value: string;
  variant?: "default" | "secondary";
  handleOnClick?: () => void;
};

export const SubmitButton = ({
  className,
  isLoading,
  value,
  variant,
  handleOnClick,
}: SubmitButtonProps) => {
  return (
    <Button
      type="submit"
      disabled={isLoading}
      className={cn("w-full", className)}
      variant={variant}
      size={"sm"}
      onClick={handleOnClick}
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
};

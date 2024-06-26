"use client";

import { Button } from "@/components/ui/button";
import { LoaderPinwheel } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

type SubmitButtonProps = {
  className?: string;
  isLoading: boolean;
  value: string;
  variant?: "default" | "secondary";
  handleOnClick: () => void;
};

export const SubmitButton = ({
  className,
  isLoading,
  value,
  variant,
  handleOnClick,
}: SubmitButtonProps) => {
  // const { pending, action, data, method } = useFormStatus(); Will not work as i make my way around action prop

  return (
    <Button
      type="submit"
      disabled={isLoading}
      className={cn("w-full", className)}
      variant={variant}
      onClick={handleOnClick}
    >
      {isLoading ? <LoaderPinwheel className="animate-spin" /> : value}
    </Button>
  );
};

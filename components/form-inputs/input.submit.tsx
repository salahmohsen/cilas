"use client";

import { Button, ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/utils";
import { LoaderPinwheel } from "lucide-react";
import { forwardRef } from "react";
import { useFormStatus } from "react-dom";

interface SubmitButtonProps extends ButtonProps {
  className?: string;
  isLoading?: boolean;
  variant?: "default" | "secondary";
  handleOnClick?: () => void;
  children?: string;
}

export const SubmitButton = forwardRef<HTMLButtonElement, SubmitButtonProps>(
  ({ className, isLoading, variant, handleOnClick, children, ...props }, ref) => {
    const { pending } = useFormStatus();

    return (
      <Button
        type="submit"
        disabled={isLoading}
        className={cn("submit-btn cursor-pointer", className)}
        variant={variant}
        size={"sm"}
        onClick={handleOnClick}
        ref={ref}
        {...props}
      >
        {isLoading || pending ? (
          <span className="flex gap-2">
            <LoaderPinwheel className="animate-spin" /> {children}
          </span>
        ) : (
          children
        )}
      </Button>
    );
  },
);

SubmitButton.displayName = "SubmitButton";

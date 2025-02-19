"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { LoaderPinwheel } from "lucide-react";
import Link from "next/link";
import { forwardRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  buttonVariants,
  Button as ShadcnButton,
  ButtonProps as ShadcnButtonProps,
} from "../ui/button";

export { buttonVariants };

export interface ButtonProps extends ShadcnButtonProps {
  icon?: ReactNode;
  link?: string;
  isLoading?: boolean;
  pendingText?: string;
  pendingIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ icon, link, asChild = false, isLoading, type, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "span";

    const buttonContent = (
      <Comp className="flex items-center gap-2">
        {icon && !isLoading && <span className="flex h-4 w-4 items-center">{icon}</span>}
        {isLoading ? (
          <>
            <LoaderPinwheel className="animate-spin" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );

    if (type === "submit") {
      return (
        <SubmitButton {...props} ref={ref} type={type} isLoading={isLoading} icon={icon}>
          {children}
        </SubmitButton>
      );
    }

    if (link && !asChild) {
      return (
        <Link href={link} className="inline-block">
          <ShadcnButton
            {...props}
            className={cn(props.className, !props.disabled && "cursor-pointer")}
            ref={ref}
          >
            {buttonContent}
          </ShadcnButton>
        </Link>
      );
    }

    return (
      <ShadcnButton {...props} asChild={asChild} ref={ref}>
        {buttonContent}
      </ShadcnButton>
    );
  },
);

const SubmitButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, isLoading, pendingText, pendingIcon, children, ...props }, ref) => {
    const { pending } = useFormStatus();
    const isPending = pending || isLoading;

    return (
      <ShadcnButton
        {...props}
        ref={ref}
        type="submit"
        className={cn(
          className,
          "submit-btn",
          (!isPending || !props.disabled) && "cursor-pointer",
        )}
        disabled={isPending || props.disabled}
      >
        <span className="flex items-center gap-2">
          {isPending
            ? pendingIcon || <LoaderPinwheel className="animate-spin" />
            : props.icon && (
                <span className="flex h-4 w-4 items-center">{props.icon}</span>
              )}
          {isPending ? pendingText || children : children}
        </span>
      </ShadcnButton>
    );
  },
);

SubmitButton.displayName = "SubmitButton";
Button.displayName = "Button";

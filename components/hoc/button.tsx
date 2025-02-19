"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import { LoaderPinwheel } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  buttonVariants,
  Button as ShadcnButton,
  ButtonProps as ShadcnButtonProps,
} from "../ui/button";

export { buttonVariants };

export interface ButtonProps extends Omit<ShadcnButtonProps, "type"> {
  icon?: ReactNode;
  href?: string;
  isLoading?: boolean;
  pendingText?: string;
  pendingIcon?: ReactNode;
  ariaLabelName?: string;
  type?: "button" | "submit" | "reset" | "sidebarBtn";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ icon, href, asChild = false, isLoading, type, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const buttonContent = (
      <Comp ref={ref} className="flex items-center gap-2">
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
        <SubmitBtn {...props} ref={ref} type={type} isLoading={isLoading} icon={icon}>
          {children}
        </SubmitBtn>
      );
    }

    if (type === "sidebarBtn") {
      return (
        <SideBarBtn {...props} ref={ref} isLoading={isLoading} icon={icon}>
          {children}
        </SideBarBtn>
      );
    }

    if (href && !asChild) {
      return (
        <Link href={href} className="inline-block">
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

const SubmitBtn = forwardRef<HTMLButtonElement, ButtonProps>(
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

const SideBarBtn = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ ariaLabelName, className, href, icon }: ButtonProps) => {
    const path = usePathname();

    return (
      <Button
        aria-label={ariaLabelName}
        className={cn(`rounded-lg ${path === href ? "bg-muted" : null}`, className)}
        size="icon"
        variant="ghost"
      >
        {icon}
      </Button>
    );
  },
);

SubmitBtn.displayName = "SubmitButton";
SideBarBtn.displayName = "SideBarBtn";
Button.displayName = "Button";

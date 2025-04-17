"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LoaderPinwheel } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, ReactNode, useMemo } from "react";
import { useFormStatus } from "react-dom";
import {
  buttonVariants,
  Button as ShadcnButton,
  ButtonProps as ShadcnButtonProps,
} from "../ui/button";

export { buttonVariants };

export interface ButtonProps extends ShadcnButtonProps {
  icon?: ReactNode;
  href?: string;
  isLoading?: boolean;
  pendingText?: string;
  pendingIcon?: ReactNode;
  isSidebarBtn?: boolean;
  tooltip?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      icon,
      href,
      asChild = false,
      isSidebarBtn,
      isLoading,
      type,
      tooltip,
      children,
      ...props
    },
    ref,
  ) => {
    const buttonContent = useMemo(
      () => (
        <span className="flex items-center gap-2">
          {(isLoading || icon) && (
            <span className="inline-flex items-center justify-center">
              {isLoading && type !== "submit" ? (
                <LoaderPinwheel className="h-4 w-4 animate-spin" />
              ) : (
                icon && <span className="flex h-4 w-4 items-center">{icon}</span>
              )}
            </span>
          )}
          {children}
        </span>
      ),
      [children, icon, isLoading, type],
    );

    if (type === "submit") {
      return (
        <SubmitBtn
          {...props}
          ref={ref}
          className={cn(
            props.className,
            "submit-btn",
            !props.disabled && "cursor-pointer",
          )}
          type={type}
          isLoading={isLoading}
          icon={icon}
          asChild={asChild}
        >
          {buttonContent}
        </SubmitBtn>
      );
    }

    if (isSidebarBtn) {
      return (
        <SideBarBtn
          {...props}
          className={props.className}
          ref={ref}
          isLoading={isLoading}
          icon={icon}
          asChild={asChild}
        >
          {buttonContent}
        </SideBarBtn>
      );
    }

    if (href) {
      return (
        <Link
          href={href}
          className={cn(
            buttonVariants({ variant: props.variant, size: props.size }),
            props.className,
          )}
          role="button"
          aria-disabled={props.disabled}
          tabIndex={props.disabled ? -1 : 0}
        >
          {asChild ? children : buttonContent}
        </Link>
      );
    }

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <ShadcnButton
              {...props}
              ref={ref}
              asChild={asChild}
              className={cn(!props.disabled && "cursor-pointer", props.className)}
            >
              {asChild ? children : buttonContent}
            </ShadcnButton>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <ShadcnButton
        {...props}
        ref={ref}
        asChild={asChild}
        className={cn(!props.disabled && "cursor-pointer", props.className)}
      >
        {asChild ? children : buttonContent}
      </ShadcnButton>
    );
  },
);

const SubmitBtn = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { isLoading, pendingText, pendingIcon, children, asChild, icon, className, ...props },
    ref,
  ) => {
    const { pending } = useFormStatus();
    const isPending = pending || isLoading;

    return (
      <ShadcnButton
        {...props}
        ref={ref}
        asChild={asChild}
        type="submit"
        className={cn(className, "submit-btn")}
        disabled={isPending || props.disabled}
      >
        {asChild ? (
          children
        ) : (
          <>
            {isPending
              ? pendingIcon || <LoaderPinwheel className="animate-spin" />
              : icon}
            {isPending ? pendingText || children : children}
          </>
        )}
      </ShadcnButton>
    );
  },
);

const SideBarBtn = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      name,
      className,
      href,
      asChild,
      size = "icon",
      variant = "ghost",
      isLoading,
      ...props
    },
    ref,
  ) => {
    const path = usePathname();

    const isOpened = path.includes(name?.toLowerCase().replaceAll(" ", "-") ?? "");

    return (
      <ShadcnButton
        {...props}
        ref={ref}
        asChild={asChild}
        aria-label={name}
        size={size}
        variant={variant}
        className={cn(
          `bg-accent h-10 w-10 rounded-full ${isOpened && "bg-neutral-300"}`,
          className,
        )}
      >
        {asChild ? (
          props.children
        ) : (
          <span className="flex items-center gap-2">
            {props.icon}
            {props.children}
          </span>
        )}
      </ShadcnButton>
    );
  },
);

SubmitBtn.displayName = "SubmitButton";
SideBarBtn.displayName = "SideBarBtn";
Button.displayName = "Button";

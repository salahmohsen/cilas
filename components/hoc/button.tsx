import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import Link from "next/link";
import { ReactNode } from "react";
import { Button as ShadcnButton, ButtonProps as ShadcnButtonProps } from "../ui/button";

interface ButtonProps extends ShadcnButtonProps {
  icon?: ReactNode;
  link?: string;
}

const Button = ({ icon, link, asChild = false, children, ...props }: ButtonProps) => {
  const Comp = asChild ? Slot : "span";

  const buttonContent = (
    <Comp className="flex items-center gap-2">
      {icon && <span className="flex h-4 w-4 items-center">{icon}</span>}
      {children}
    </Comp>
  );

  if (link && !asChild) {
    return (
      <Link href={link} className="inline-block">
        <ShadcnButton {...props} className={cn(props.className, "cursor-pointer")}>
          {buttonContent}
        </ShadcnButton>
      </Link>
    );
  }

  return (
    <ShadcnButton asChild={asChild} {...props}>
      {buttonContent}
    </ShadcnButton>
  );
};

export default Button;

"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SideBarButtonProps = {
  name: string;
  className?: string;
  href: string;
  icon: React.ReactNode;
};

export const SideBarButton = ({
  name,
  className,
  href,
  icon,
}: SideBarButtonProps) => {
  const path = usePathname();

  return (
    <Button
      aria-label={name}
      className={cn(
        `rounded-lg ${path === href ? "bg-muted" : null}`,
        className,
      )}
      size="icon"
      variant="ghost"
    >
      {icon}
    </Button>
  );
};

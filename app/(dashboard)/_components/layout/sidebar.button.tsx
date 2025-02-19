"use client";

import { Button } from "@/components/hoc/button";
import { cn } from "@/lib/utils/utils";
import { usePathname } from "next/navigation";

type SideBarButtonProps = {
  name: string;
  className?: string;
  href: string;
  icon: React.ReactNode;
};

export const SideBarButton = ({ name, className, href, icon }: SideBarButtonProps) => {
  const path = usePathname();

  return (
    <Button
      aria-label={name}
      className={cn(`rounded-lg ${path === href ? "bg-muted" : null}`, className)}
      size="icon"
      variant="ghost"
    >
      {icon}
    </Button>
  );
};

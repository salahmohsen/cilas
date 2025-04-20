import React from "react";

import { Button } from "@/components/hoc/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SidebarItem({
  name,
  href,
  className,
  icon,
  onClick,
}: {
  name: string;
  href: string;
  icon: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const path = usePathname();
  const active = path === href;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>
          <Button
            isSidebarBtn
            asChild
            name={name}
            className={cn(className, active && "bg-primary **:text-background")}
            href={href}
            icon={icon}
            onClick={onClick}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={5}>
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

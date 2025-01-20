import React from "react";

import {
  TooltipTrigger,
  TooltipContent,
  Tooltip,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { SideBarButton } from "./sidebar.button";

export function SidebarItem({
  name,
  href,
  className,
  icon,
}: {
  name: string;
  href: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>
          <SideBarButton
            name={name}
            className={className}
            href={href}
            icon={icon}
          />
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={5}>
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

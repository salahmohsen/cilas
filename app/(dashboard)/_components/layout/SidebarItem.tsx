import React from "react";

import { Button } from "@/components/hoc/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
          <Button
            type="sidebarBtn"
            name={name}
            className={cn(className, "cursor-pointer")}
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

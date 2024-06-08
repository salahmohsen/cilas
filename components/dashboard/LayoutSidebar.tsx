"use client";
import Image from "next/image";
import Link from "next/link";

import {
  TooltipTrigger,
  TooltipContent,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/tooltip";
import logo from "@/public/logo.png";
import { Button } from "@/components/ui/button";
import {
  BookIcon,
  FileCode2Icon,
  Home,
  LifeBuoyIcon,
  Settings2Icon,
  SquareLibrary,
  SquareUserIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { ReactElement } from "react";
import { cn } from "@/lib/utils";

export default function LayoutSidebar() {
  return (
    <aside className="inset-y fixed left-0 z-20 hidden h-full flex-col border-r sm:flex">
      <div className="border-b p-2">
        <Button aria-label="Home" size="icon" variant="ghost">
          <Image src={logo} alt="Cilas" width={16} className="h-auto" />
        </Button>
      </div>
      <nav className="grid gap-1 p-2">
        <TooltipProvider>
          <SidebarItem
            name="Home"
            href="/dashboard"
            icon={<Home className="size-5" />}
          />
          <SidebarItem
            name="Courses"
            href="/dashboard/courses"
            icon={<SquareLibrary className="size-5" />}
          />
          <SidebarItem
            name="Settings"
            href="/dashboard/settings"
            icon={<Settings2Icon className="size-5" />}
          />
        </TooltipProvider>
      </nav>
      <nav className="mt-auto grid gap-1 p-2">
        <TooltipProvider>
          <SidebarItem
            name="Help"
            href="/dashboard/help"
            icon={<LifeBuoyIcon className="size-5" />}
            className="mt-auto"
          />
          <SidebarItem
            name="Account"
            href="/dashboard/account"
            icon={<SquareUserIcon className="size-5" />}
            className="mt-auto"
          />
        </TooltipProvider>
      </nav>
    </aside>
  );
}

function SidebarItem({
  name,
  href,
  icon,
  className,
}: {
  name: string;
  href: string;
  icon: ReactElement;
  className?: string;
}) {
  const path = usePathname();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link href={href}>
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
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={5}>
        {name}
      </TooltipContent>
    </Tooltip>
  );
}

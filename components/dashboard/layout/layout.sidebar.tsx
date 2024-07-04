"use client";

import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

import Image from "next/image";
import Link from "next/link";

import logo from "@/public/logo.png";

import { Button } from "@/components/ui/button";
import {
  TooltipTrigger,
  TooltipContent,
  Tooltip,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Home,
  LifeBuoyIcon,
  Moon,
  Settings2Icon,
  SquareLibrary,
  SquareUserIcon,
  Sun,
} from "lucide-react";

import { ReactElement } from "react";

export function LayoutSidebar() {
  return (
    <aside className="inset-y fixed left-0 z-20 hidden h-full flex-col border-r sm:flex">
      <div className="border-b p-2">
        <Link href="/">
          <Button aria-label="Home" size="icon" variant="ghost">
            <Image
              src={logo}
              alt="Cilas"
              width={16}
              className="h-auto dark:invert"
            />
          </Button>
        </Link>
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

          <ThemeToggle />
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

function ThemeToggle() {
  const { setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

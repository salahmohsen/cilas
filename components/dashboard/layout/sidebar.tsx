import Image from "next/image";
import Link from "next/link";

import logo from "@/public/logo.png";

import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

import {
  Home,
  LifeBuoyIcon,
  Settings2Icon,
  SquareLibrary,
  SquareUserIcon,
} from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { ThemeToggle } from "./theme.toggle";

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
            href="/dashboard/course-management"
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

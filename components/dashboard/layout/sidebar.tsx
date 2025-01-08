import { TooltipProvider } from "@/components/ui/tooltip";

import { cn } from "@/lib/utils/utils";
import { Home, Rss, SquareLibrary } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { ThemeToggle } from "./theme.toggle";

export function LayoutSidebar({ className }: { className: string }) {
  return (
    <aside
      className={cn(
        "fixed hidden flex-col items-center justify-between border-r bg-background sm:flex",
        className,
      )}
    >
      <nav className="grid gap-1 p-2">
        <TooltipProvider>
          <SidebarItem
            name="Home"
            href="/dashboard"
            icon={<Home className="size-5" />}
          />
          <SidebarItem
            name="Course Management"
            href="/admin/course-management"
            icon={<SquareLibrary className="size-5" />}
          />
          <SidebarItem
            name="Blog Management"
            href="/dashboard/blog-management"
            icon={<Rss className="size-5" />}
          />
          {/* <SidebarItem
            name="Settings"
            href="/dashboard/settings"
            icon={<Settings2Icon className="size-5" />}
          /> */}
        </TooltipProvider>
      </nav>
      <nav className="grid gap-1 p-2">
        <TooltipProvider>
          {/* <SidebarItem
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
          /> */}

          <ThemeToggle />
        </TooltipProvider>
      </nav>
    </aside>
  );
}

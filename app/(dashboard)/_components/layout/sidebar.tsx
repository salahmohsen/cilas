import { cn } from "@/lib/utils/utils";
import { Home, Rss, SquareLibrary } from "lucide-react";
import { SidebarItem } from "./SidebarItem";
import { ThemeToggle } from "./theme.toggle";

export function LayoutSidebar({ className }: { className: string }) {
  return (
    <aside
      className={cn(
        "bg-background fixed hidden flex-col items-center justify-between border-r sm:flex",
        className,
      )}
    >
      <nav className="grid gap-1 p-2">
        <SidebarItem name="Home" href="/admin" icon={<Home className="size-5" />} />
        <SidebarItem
          name="Course Management"
          href="/admin/course-management"
          icon={<SquareLibrary className="size-5" />}
        />
        <SidebarItem
          name="Blog Management"
          href="/admin/blog-management"
          icon={<Rss className="size-5" />}
        />
        {/* <SidebarItem
            name="Settings"
            href="/dashboard/settings"
            icon={<Settings2Icon className="size-5" />}
          /> */}
      </nav>
      <nav className="grid gap-1 p-2">
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
      </nav>
    </aside>
  );
}

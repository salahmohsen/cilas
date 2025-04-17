import { cn } from "@/lib/utils/utils";
import logo from "@/public/logo.png";
import { Home, Rss, SquareLibrary } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { SidebarAvatar } from "./sidebar.avatar";
import { SidebarItem } from "./SidebarItem";
import { ThemeToggle } from "./theme.toggle";

export function LayoutSidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("flex h-screen flex-col items-center gap-3", className)}>
      <Link href="/" className="relative h-10 w-10">
        <Image
          src={logo}
          alt="Cilas"
          fill
          className="absolute w-auto object-contain dark:invert"
        />
      </Link>
      <div className="flex h-full flex-col items-center justify-center gap-5 rounded-full">
        <nav className="m-2.5 flex w-full flex-col items-center justify-center gap-5">
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
        </nav>
        <div className="mt-auto mb-2.5 flex flex-col gap-5">
          <SidebarAvatar />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

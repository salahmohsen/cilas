import Link from "next/link";

import { Button } from "@/components/hoc/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@/public/logo.png";
import { Home, PanelLeft, Rss, SquareLibrary } from "lucide-react";
import Image from "next/image";

export function LayoutMobileSidebar() {
  return (
    <Sheet>
      <SheetTrigger asChild className="z-50">
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="z-50 sm:max-w-xs">
        <nav className="grid gap-6 text-xs font-medium">
          <Link
            href="#"
            className="group bg-primary flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full"
          >
            <Image
              src={logo}
              width={15}
              alt="Cairo Institute of Liberal Arts and Sciences"
              className="invert transition-all group-hover:scale-110 dark:invert-0"
            />
            {/* <Package2 className="h-5 w-5 transition-all group-hover:scale-110" /> */}
            <span className="sr-only">Cairo Institute of Liberal Arts and Sciences</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground flex items-center gap-4 px-2.5"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/admin/course-management"
            className="text-muted-foreground hover:text-foreground flex items-center gap-4 px-2.5"
          >
            <SquareLibrary className="h-5 w-5" />
            Course Management
          </Link>
          <Link
            href="/dashboard/posts-management"
            className="text-muted-foreground hover:text-foreground flex items-center gap-4 px-2.5"
          >
            <Rss className="h-5 w-5" />
            Blog Management
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

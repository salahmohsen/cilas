"use client";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUserStore } from "@/lib/users/user.slice";
import { cn } from "@/lib/utils";
import logo from "@/public/logo.png";
import { Bird, Home, Menu, Origami } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";

export const MobileHeader = () => {
  const [open, setOpen] = useState(false);
  const { userInfo } = useUserStore();

  return (
    <div className="bg-background sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2 md:hidden">
      <div className="flex flex-1 items-center">
        <Link href="/" className="relative h-10 w-10">
          <Image
            src={logo}
            alt="Cilas"
            fill
            className="absolute w-auto object-contain dark:invert"
          />
        </Link>
        <span className="text-sm">Cairo Institute of Liberal Arts and Sciences</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="z-50">
          <Button size="icon" variant="outline" className="border-0">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="z-50 px-4">
          <nav className="space-y-4 text-xs font-medium">
            <div className="text-muted-foreground my-5 flex items-center gap-3 text-base">
              {userInfo && <Avatar user={userInfo} />}
              welcome {userInfo?.firstName}
            </div>
            <MenuItem
              title="Home"
              href="/admin"
              icon={<Home className="h-6 w-6" strokeWidth={0.67} />}
              setOpen={setOpen}
            />
            <MenuItem
              title="Course management"
              href="/admin/course-management"
              icon={<Bird className="h-6 w-6" strokeWidth={0.67} />}
              setOpen={setOpen}
            />
            <MenuItem
              title="Posts management"
              href="/admin/post-management"
              icon={<Origami className="h-6 w-6" strokeWidth={0.67} />}
              setOpen={setOpen}
            />
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
};

const MenuItem = ({
  title,
  href,
  icon,
  setOpen,
}: {
  title: string;
  href: string;
  icon: ReactNode;
  setOpen: (open: boolean) => void;
}) => {
  const path = usePathname();
  const isActive = href.includes(path);

  return (
    <Link
      href={href}
      className={cn("flex items-center gap-5 rounded-md p-2", isActive && "bg-accent")}
      onClick={() => setOpen(false)}
    >
      {icon}
      {title}
    </Link>
  );
};

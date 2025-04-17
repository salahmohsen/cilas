"use client";
1234;
import Image from "next/image";
import Link from "next/link";

import { useUserStore } from "@/lib/store/user.slice";
import { cn } from "@/lib/utils/utils";

import { Input } from "@/components/ui/input";
import { LayoutBreadcrumb } from "./breadcrumb";
import { LayoutMobileSidebar } from "./sidebar.mobile";

import logo from "@/public/logo.png";
import { Search } from "lucide-react";

export function LayoutHeader({ className }: { className: string }) {
  const { userInfo } = useUserStore();
  if (userInfo)
    return (
      <header
        className={cn(
          "bg-background fixed top-0 flex w-full items-center justify-between gap-1 border-b",
          className,
        )}
      >
        <div className="flex h-full items-center gap-2">
          <div className="mr-4 hidden h-full items-center sm:flex">
            <Link
              href="/"
              className="hover:bg-accent flex h-full w-16 items-center justify-center border-r"
            >
              <Image src={logo} alt="Cilas" width={20} className="h-auto dark:invert" />
            </Link>
          </div>
          <LayoutMobileSidebar />
          <LayoutBreadcrumb />
        </div>
        <div className="flex gap-3">
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              type="search"
              placeholder="Search..."
              className="bg-background w-full rounded-lg pl-8 md:w-[200px] lg:w-[336px]"
              id="header-search"
            />
          </div>
        </div>
      </header>
    );
}

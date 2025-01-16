"use client";
1234;
import Image from "next/image";
import Link from "next/link";

import { logout } from "@/lib/actions/auth.actions";
import { useUserStore } from "@/lib/store/user.slice";
import { cn } from "@/lib/utils/utils";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { LayoutBreadcrumb } from "./breadcrumb";
import { LayoutMobileSidebar } from "./sidebar.mobile";

import logo from "@/public/logo.png";
import PlaceHolderUser from "@/public/placeholder-user.svg";
import { Search } from "lucide-react";

export function LayoutHeader({ className }: { className: string }) {
  const { userInfo } = useUserStore();
  if (userInfo)
    return (
      <header
        className={cn(
          "fixed top-0 flex w-full items-center justify-between gap-1 border-b bg-background",
          className,
        )}
      >
        <div className="flex h-full items-center gap-2">
          <div className="mr-4 hidden h-full items-center sm:flex">
            <Link
              href="/"
              className="flex h-full w-16 items-center justify-center border-r hover:bg-accent"
            >
              <Image
                src={logo}
                alt="Cilas"
                width={20}
                className="h-auto dark:invert"
              />
            </Link>
          </div>
          <LayoutMobileSidebar />
          <LayoutBreadcrumb />
        </div>
        <div className="flex gap-3">
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[336px]"
              id="header-search"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="overflow-hidden rounded-full"
              >
                {!userInfo.avatar && (
                  <PlaceHolderUser className="overflow-hidden rounded-full p-2 opacity-70" />
                )}
                {userInfo.avatar && (
                  <Image
                    src={userInfo.avatar}
                    width={36}
                    height={36}
                    alt="Avatar"
                    className={`overflow-hidden rounded-full ${!userInfo.avatar && "p-2 opacity-70"}`}
                  />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-40">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Support</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    );
}

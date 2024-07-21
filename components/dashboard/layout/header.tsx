"use client";

import Image from "next/image";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/public/logo.png";
import PlaceHolderUser from "@/public/placeholder-user.svg";

import { Search } from "lucide-react";
import { LayoutMobileSidebar } from "./sidebar.mobile";
import { LayoutBreadcrumb } from "./breadcrumb";
import { logout } from "@/actions/auth.actions";
import React, { useEffect, useState } from "react";
import { getUserAvatar } from "@/actions/users.actions";
import Link from "next/link";
import { LayoutSidebar } from "./sidebar";
import { cn } from "@/lib/utils";

export function LayoutHeader({
  className,
  userId,
}: {
  className: string;
  userId: string;
}) {
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    const fetchAvatar = async () => {
      const avatar = await getUserAvatar(userId);
      setAvatar(avatar);
    };
    fetchAvatar();
  }, [userId]);
  return (
    <header
      className={cn(
        "fixed top-0 z-50 flex w-full items-center justify-between gap-1 border-b bg-background",
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
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="overflow-hidden rounded-full"
            >
              {!avatar && (
                <PlaceHolderUser className="overflow-hidden rounded-full p-2 opacity-70" />
              )}
              {avatar && (
                <Image
                  src={avatar}
                  width={36}
                  height={36}
                  alt="Avatar"
                  className={`overflow-hidden rounded-full ${!avatar && "p-2 opacity-70"}`}
                />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()}>Logout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

"use client";
import Image from "next/image";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import placeholderUser from "@/public/placeholder-user.svg";

import { Search } from "lucide-react";
import { LayoutMobileSidebar } from "./sidebar.mobile";
import { LayoutBreadcrumb } from "./breadcrumb";
import { logout } from "@/actions/auth.actions";

export function LayoutHeader({ children }) {
  return (
    <div className="flex flex-col gap-4 sm:pl-14 md:py-0">
      <header className="sticky top-0 z-10 flex h-[57px] w-full items-center justify-between gap-1 border-b bg-background px-4">
        <div className="flex items-center gap-2">
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
                <Image
                  src={placeholderUser}
                  width={36}
                  height={36}
                  alt="Avatar"
                  className="overflow-hidden rounded-full p-2 opacity-70"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      {children}
    </div>
  );
}

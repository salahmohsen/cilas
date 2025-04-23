"use client";

import { logout } from "@/app/(Auth)/_lib/auth.actions";
import { Button } from "@/components/hoc/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserStore } from "@/lib/users/user.slice";
import { UserRound } from "lucide-react";
import Image from "next/image";

export const SidebarAvatar = () => {
  const { userInfo } = useUserStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="h-10 w-10 rounded-full">
        <Button variant="outline" size="icon" className="overflow-hidden rounded-full">
          {userInfo && !userInfo.avatar && (
            <UserRound className="overflow-hidden rounded-full p-2 opacity-70" />
          )}
          {userInfo && userInfo.avatar && (
            <Image
              src={userInfo.avatar}
              width={40}
              height={40}
              alt="Avatar"
              className={`overflow-hidden rounded-full ${!userInfo.avatar && "p-2 opacity-70"}`}
            />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="z-40">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

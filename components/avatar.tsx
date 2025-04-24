"use client";

import {
  IsMainAuthor,
  Role,
} from "@/app/(dashboard)/admin/posts-management/_lib/posts.actions.type";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SafeUser } from "@/lib/drizzle/drizzle.types";
import { cn } from "@/lib/utils";
import { forwardRef, useCallback, useMemo, useState } from "react";
import { Avatar as AvatarComponent, AvatarFallback, AvatarImage } from "./ui/avatar";

type AvatarProps = React.ComponentPropsWithoutRef<typeof AvatarComponent> & {
  user: SafeUser;
};

const Avatar = forwardRef<React.ElementRef<typeof AvatarComponent>, AvatarProps>(
  ({ user, className, onClick, ...props }, ref) => {
    const getFallback = useCallback(() => {
      const firstNameChar = user.firstName?.slice(0, 1).toUpperCase() || "";
      const lastNameChar = user.lastName?.slice(0, 1).toUpperCase() || "";
      return firstNameChar || lastNameChar ? `${firstNameChar}${lastNameChar}` : "?";
    }, [user.firstName, user.lastName]);

    const avatar = useMemo(() => user.avatar ?? undefined, [user]);

    return (
      <AvatarComponent
        className={cn(className, onClick ? "cursor-pointer" : "cursor-default")}
        ref={ref}
        onClick={onClick}
        {...props}
      >
        <AvatarImage
          src={avatar}
          alt={`${user.firstName} ${user.lastName}`}
          data-userid={user.id}
        />
        {<AvatarFallback data-userid={user.id}>{getFallback()}</AvatarFallback>}
      </AvatarComponent>
    );
  },
);

interface Users extends SafeUser {
  authorRole?: Role;
  isMainAuthor?: IsMainAuthor;
}

type AvatarGroupProps = React.ComponentPropsWithoutRef<typeof AvatarComponent> & {
  users: Users[];
};

function AvatarGroup({ users, ...props }: AvatarGroupProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const lastIndex = users.length - 1;

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      // First check if user is main author
      const aIsMain = a.isMainAuthor || false;
      const bIsMain = b.isMainAuthor || false;

      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;

      // If both are main authors or both are not, sort alphabetically by name
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
  }, [users]);

  return (
    <div className="group flex -space-x-2">
      {sortedUsers.map((user, index) => {
        const isLast = index === lastIndex;
        const fullname = `${user.firstName} ${user.lastName}`;
        const role = user?.authorRole?.enName || user.authorRole?.arName;

        return (
          <Tooltip key={index}>
            <TooltipTrigger asChild className={cn(isLast && "group-hover:mr-0")}>
              <Avatar
                user={user}
                className={cn(
                  "ring-background ring-1 transition-transform",
                  activeIndex === index && "z-10 scale-110",
                )}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                {...props}
              />
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-semibold">{fullname}</p>
              {role && <p className="text-sm">{role}</p>}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

Avatar.displayName = "Avatar";

export { Avatar, AvatarGroup };

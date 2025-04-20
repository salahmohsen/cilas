import { SafeUser } from "@/lib/types/drizzle.types";
import { cn } from "@/lib/utils";
import { forwardRef, useCallback } from "react";
import { Avatar as AvatarComponent, AvatarFallback, AvatarImage } from "./ui/avatar";

type AvatarComponentProps = {
  user: SafeUser;
  className?: string;
  onClick?: () => void;
};

export const Avatar = forwardRef<HTMLDivElement, AvatarComponentProps>(
  ({ user, className, onClick }, ref) => {
    const getFallback = useCallback(() => {
      const firstNameChar = user.firstName?.slice(0, 1).toUpperCase() || "";
      const lastNameChar = user.lastName?.slice(0, 1).toUpperCase() || "";
      return firstNameChar || lastNameChar ? `${firstNameChar}${lastNameChar}` : "?";
    }, [user.firstName, user.lastName]);

    return (
      <AvatarComponent className={cn(className, onClick && "cursor-pointer")} ref={ref}>
        <AvatarImage
          src={user.avatar || undefined}
          alt={`${user.firstName} ${user.lastName}`}
          onClick={onClick}
        />
        <AvatarFallback onClick={onClick}>{getFallback()}</AvatarFallback>
      </AvatarComponent>
    );
  },
);

Avatar.displayName = "AvatarComponent";

import { userLocalInfo } from "@/lib/types/drizzle.types";
import { cn } from "@/lib/utils";
import { useCallback } from "react";
import { Avatar as AvatarComponent, AvatarFallback, AvatarImage } from "./ui/avatar";

type AvatarComponentProps = {
  user: userLocalInfo;
  className?: string;
  onClick?: () => void;
};

export const Avatar = (
  {
    ref,
    user,
    className,
    onClick
  }: AvatarComponentProps & {
    ref: React.RefObject<HTMLDivElement>;
  }
) => {
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
};

Avatar.displayName = "AvatarComponent";

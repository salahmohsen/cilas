import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Avatar as AvatarComponent, AvatarFallback, AvatarImage } from "./ui/avatar";

type AvatarComponentProps = {
  avatar?: string;
  alt?: string;
  fallback: string;
  className?: string;
  onClick?: () => void;
};

export const Avatar = forwardRef<HTMLDivElement, AvatarComponentProps>(
  ({ avatar, alt, fallback, className, onClick }, ref) => {
    return (
      <AvatarComponent className={cn(className, onClick && "cursor-pointer")} ref={ref}>
        <AvatarImage src={avatar} alt={alt} onClick={onClick} />
        <AvatarFallback onClick={onClick}>{fallback}</AvatarFallback>
      </AvatarComponent>
    );
  },
);

Avatar.displayName = "AvatarComponent";

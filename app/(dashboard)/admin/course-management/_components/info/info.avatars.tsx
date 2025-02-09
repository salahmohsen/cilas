import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { userLocalInfo } from "@/lib/types/drizzle.types";

type UserAvatarProps = {
  user: userLocalInfo;
};

export function UserAvatar({ user }: UserAvatarProps) {
  return (
    <Avatar>
      <AvatarImage src={user.avatar ?? ""} alt={`${user.firstName} ${user.lastName}`} />
      <AvatarFallback>
        {user.firstName?.slice(0, 1).toUpperCase()}{" "}
        {user.lastName?.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
}

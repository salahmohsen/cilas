import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { userLocalInfo } from "@/lib/types/drizzle.types";
import { UserSettings } from "./user.settings";

type UserAvatarProps = {
  user: userLocalInfo;
  className?: string;
};

export function UserAvatar({ user }: UserAvatarProps) {
  const {} = user;
  return (
    <Dialog>
      <DialogTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <AvatarComponent user={user} />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>
                {user.firstName} {user.lastName}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DialogTrigger>
      <DialogContent className="h-2/3 w-2/3 max-w-full border-0 p-0">
        <UserSettings user={user} />
      </DialogContent>
    </Dialog>
  );
}

export const AvatarComponent = ({ user, className }: UserAvatarProps) => {
  return (
    <Avatar className={className}>
      <AvatarImage src={user.avatar ?? ""} alt={`${user.firstName} ${user.lastName}`} />
      <AvatarFallback>
        {user.firstName?.slice(0, 1).toUpperCase()}{" "}
        {user.lastName?.slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );
};

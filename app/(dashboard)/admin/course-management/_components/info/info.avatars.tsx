import { Avatar } from "@/components/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SafeUser } from "@/lib/types/drizzle.types";
import { useState } from "react";
import { UserSettings } from "./user.settings";

type UserAvatarProps = {
  user: SafeUser;
  courseId: number;
  className?: string;
};

export function UserAvatar({ user, courseId, className }: UserAvatarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <Tooltip delayDuration={400}>
        <TooltipTrigger className="cursor-pointer" asChild>
          <DialogTrigger>
            <Avatar user={user} />
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {user.firstName} {user.lastName}
        </TooltipContent>
      </Tooltip>

      {isDialogOpen && (
        <DialogContent className="h-2/3 w-2/3 max-w-full border-0 p-0">
          <DialogTitle className="sr-only">User profile settings</DialogTitle>
          <DialogDescription className="sr-only"></DialogDescription>

          <ScrollArea className="max-h-full">
            <UserSettings
              user={user}
              courseId={courseId}
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
            />
          </ScrollArea>
        </DialogContent>
      )}
    </Dialog>
  );
}

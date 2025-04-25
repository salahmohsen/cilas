import { AvatarGroup } from "@/components/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SafeUser } from "@/lib/drizzle/drizzle.types";
import { getUserById } from "@/lib/users/users.actions";
import { debounce } from "lodash-es";
import { LoaderPinwheel } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { UserSettingsForm } from "./user.settings.form";

type UserAvatarProps = {
  users: SafeUser[];
  courseId?: number;
  className?: string;
};

export function UserSettingDialog({ users, courseId, className }: UserAvatarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [user, setUser] = useState<SafeUser | undefined>(undefined);

  const loadUserData = useCallback(async (userId: string) => {
    setIsLoading(true);
    const user = await getUserById(userId);
    setUser(user);
    setIsLoading(false);
  }, []);

  const debouncedLoadUserData = useMemo(
    () => debounce((id: string) => loadUserData(id), 300),
    [loadUserData],
  );

  const handleAvatarClick = (e: React.MouseEvent) => {
    const userId = (e.target as HTMLElement).getAttribute("data-userid");
    if (!userId) return;
    debouncedLoadUserData(userId);
    setIsDialogOpen(true);
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger>
        <AvatarGroup users={users} onClick={(e) => handleAvatarClick(e)} />
      </DialogTrigger>

      {isDialogOpen && user && (
        <DialogContent className="h-2/3 w-2/3 max-w-full border-0 p-0">
          <DialogTitle className="sr-only">User profile settings</DialogTitle>
          <DialogDescription className="sr-only"></DialogDescription>
          {isLoading && (
            <div className="flex h-full w-full items-center justify-center gap-2">
              <LoaderPinwheel className="animate-spin" />
              loading...
            </div>
          )}
          {!isLoading && (
            <ScrollArea className="max-h-full">
              <UserSettingsForm
                user={user}
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
              />
            </ScrollArea>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { userLocalInfo } from "@/lib/types/drizzle.types";
import { UserCog, UserPen } from "lucide-react";
import { AvatarComponent } from "./info.avatars";

type UserSettingsProps = {
  user: userLocalInfo;
};
export const UserSettings = ({ user }: UserSettingsProps) => {
  return (
    <>
      <Tabs defaultValue="profile" className="flex min-w-96" orientation="vertical">
        <TabsList className="my-0 flex h-full w-1/3 flex-col items-start justify-start overflow-hidden rounded-r-none border-r p-0 px-0 [&>*]:w-full [&>*]:rounded-none [&>*]:py-5 [&>*]:flex [&>*]:gap-3 ">
          <TabsTrigger value="profile">
            <UserPen />
            <span>Profile</span>
          </TabsTrigger>
          <TabsTrigger value="settings">
            <UserCog />
            <span>Account</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <div className="flex items-center gap-4">
            <AvatarComponent user={user} className="h-32 w-32" />
            <div className="flex flex-col items-center">
              <p>
                {user.firstName} {user.lastName}
              </p>
              {user.userName && <p className="text-gray-500">@{user.userName}</p>}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="settings">Change your password here.</TabsContent>
      </Tabs>
    </>
  );
};

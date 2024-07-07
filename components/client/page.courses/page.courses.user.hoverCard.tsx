import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { Button } from "@/components/ui/button";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { AtSign } from "lucide-react";
import Link from "next/link";

export const UserHoverCard = ({ userName, userBio, userSlug }) => {
  return (
    <div className="flex justify-start">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Button
            variant="link"
            className="h-min p-0 text-xs leading-none text-muted-foreground"
          >
            {userName}
          </Button>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="flex justify-start gap-5">
            <Avatar>
              <AvatarImage src="https://github.com/vercel.png" />
              <AvatarFallback>VC</AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h4 className="text-sm font-semibold">{userName}</h4>
              <div
                className="line-clamp-5 text-sm font-light"
                dangerouslySetInnerHTML={{ __html: userBio }}
              ></div>
              <div className="flex items-center pt-2">
                <AtSign className="mr-2 h-4 w-4 opacity-70" />
                <Link href={userSlug} className="text-xs text-muted-foreground">
                  View Profile
                </Link>
              </div>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
};

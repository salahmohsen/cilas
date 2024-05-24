import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import { Button } from "@/components/ui/button";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { AtSign } from "lucide-react";

const FacilitatorHoverCard = ({ facilitator, facilitatorInfo }) => {
  return (
    <HoverCard>
      <HoverCardTrigger>
        <Button
          variant="link"
          className=" h-min p-0 text-xs leading-none text-muted-foreground"
        >
          {facilitator}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="flex justify-between space-x-4">
          <Avatar>
            <AvatarImage src="https://github.com/vercel.png" />
            <AvatarFallback>VC</AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            <h4 className="text-sm font-semibold">{facilitator}</h4>
            <p className="line-clamp-5 text-sm font-light">{facilitatorInfo}</p>
            <div className="flex items-center pt-2">
              <AtSign className="mr-2 h-4 w-4 opacity-70" />
              <span className="text-xs text-muted-foreground">
                View Profile
              </span>
            </div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

export default FacilitatorHoverCard;

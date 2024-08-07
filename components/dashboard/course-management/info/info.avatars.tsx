import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserAvatar() {
  return (
    <Avatar>
      <AvatarImage
        src="https://static.vecteezy.com/system/resources/previews/010/345/372/non_2x/pigeon-bird-color-icon-illustration-vector.jpg"
        alt="@shadcn"
      />
      <AvatarFallback>CN</AvatarFallback>
    </Avatar>
  );
}

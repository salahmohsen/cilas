"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import UserProvider from "./user.provider";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <TooltipProvider>
      <UserProvider>{children}</UserProvider>
    </TooltipProvider>
  );
};

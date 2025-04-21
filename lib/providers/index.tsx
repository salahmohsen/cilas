"use client";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./theme.provider";
import UserProvider from "./user.provider";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <Toaster />
      <TooltipProvider>
        <UserProvider>{children}</UserProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};

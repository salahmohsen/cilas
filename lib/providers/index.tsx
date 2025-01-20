"use client";

import UserProvider from "./user.provider";

export const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return <UserProvider>{children}</UserProvider>;
};

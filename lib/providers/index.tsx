"use client";

import { User } from "lucia";
import UserProvider from "./user.provider";

export const RootProvider = ({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) => {
  return <UserProvider user={user}>{children}</UserProvider>;
};

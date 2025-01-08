"use client";

import { useEffect } from "react";
import { useUserStore } from "../store/user.slice";

const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { setUserInfo } = useUserStore();

  useEffect(() => {
    setUserInfo();
  }, [setUserInfo]);

  return <>{children}</>;
};

export default UserProvider;

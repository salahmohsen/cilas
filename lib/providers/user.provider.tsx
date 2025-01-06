"use client";

import { useEffect } from "react";
import { getCurrentUserInfo } from "../actions/users.actions";
import useUserStore from "../store/user.slice";

const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const updateUserInfo = useUserStore((state) => state.setUserInfo);

  useEffect(() => {
    const updateUserStore = async () => {
      const userInfo = await getCurrentUserInfo();
      if (userInfo) updateUserInfo(userInfo);
    };
    updateUserStore();
  }, [updateUserInfo]);

  return <>{children}</>;
};

export default UserProvider;

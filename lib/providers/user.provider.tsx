"use client";

import { User } from "lucia";
import { useEffect } from "react";
import { getUserById } from "../actions/users.actions";
import useUserStore from "../store/user.slice";

const UserProvider = ({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) => {
  const updateUserInfo = useUserStore((state) => state.setUserInfo);

  useEffect(() => {
    const updateUserStore = async () => {
      const userInfo = await getUserById(user.id);
      if (userInfo) updateUserInfo(userInfo);
    };
    updateUserStore();
  }, [updateUserInfo, user.id]);

  return <>{children}</>;
};

export default UserProvider;

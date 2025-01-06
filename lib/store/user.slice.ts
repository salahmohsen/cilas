"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { userLocalInfo } from "../types/drizzle.types";

interface UserStore {
  userInfo: userLocalInfo;
  setUserInfo: (user: userLocalInfo) => void;
}

const useUserStore = create<UserStore>()(
  devtools(
    (set) => ({
      userInfo: {
        id: "",
        email: null,
        userName: null,
        firstName: null,
        lastName: null,
        tel: null,
        avatar: null,
        bio: null,
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
      },

      // Actions
      setUserInfo: (user: userLocalInfo) => set({ userInfo: user }),
    }),
    { name: "userStore" },
  ),
);

export default useUserStore;

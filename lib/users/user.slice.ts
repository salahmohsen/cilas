"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { SafeUser } from "../drizzle/drizzle.types";
import { getCurrentUserInfo } from "./users.actions";

interface UserStore {
  userInfo: SafeUser | undefined;
  isLogged: boolean;
  setIsLogged: (isLogged: boolean) => void;
  setUserInfo: () => void;
}

export const useUserStore = create<UserStore>()(
  devtools(
    (set) => ({
      userInfo: undefined,
      userRole: (state: UserStore) => state.userInfo?.role,

      isLogged: false,

      // Actions
      setIsLogged: (isLogged: boolean) => set({ isLogged }),
      setUserInfo: async () => {
        const userInfo = await getCurrentUserInfo();
        if (userInfo) {
          set({ userInfo });
          set({ isLogged: true });
        }
      },
    }),
    { name: "userStore" },
  ),
);

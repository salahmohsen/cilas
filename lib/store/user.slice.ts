"use client";

import { create } from "zustand";
import { SafeUser } from "../types/drizzle.types";

interface UserStore {
  userInfo: SafeUser;
  setUserInfo: (user: SafeUser) => void;
}

const useUserStore = create<UserStore>((set) => ({
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
  setUserInfo: (user: SafeUser) => set({ userInfo: user }),
}));

export default useUserStore;

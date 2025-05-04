import { InferSelectModel } from "drizzle-orm";
import { userRoleEnum, userTable } from "../drizzle/schema";

export type BasePrevState = {
  success?: boolean;
  error?: boolean;
  message: string;
};

export interface AuthState extends BasePrevState {
  redirectPath?: string;
}

export interface FellowState extends BasePrevState {
  fellow?: SafeUser;
}

export type SafeUser = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserRole = (typeof userRoleEnum.enumValues)[number];

export type UserWithProtectedFields = InferSelectModel<typeof userTable>;

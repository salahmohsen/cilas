import { userLocalInfo } from "./drizzle.types";

export type BasePrevState = {
  success?: boolean;
  error?: boolean;
  message: string;
};

export interface AuthState extends BasePrevState {
  redirectPath?: string;
}

export interface FellowState extends BasePrevState {
  fellow?: userLocalInfo;
}

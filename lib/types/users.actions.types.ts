import { userLocalInfo } from "./drizzle.types";

export type FellowState = {
  success?: boolean;
  error?: boolean;
  message: string;
  fellow?: userLocalInfo;
};

export type AddStudentToCourseState = {
  success?: boolean;
  error?: boolean;
  message: string;
};

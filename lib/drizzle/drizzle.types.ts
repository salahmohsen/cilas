import { courseTable, userTable } from "@/lib/drizzle/schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type SafeUser = Omit<
  InferSelectModel<typeof userTable>,
  "passwordHash" | "googleId"
>;

export type UserWithProtectedFields = InferSelectModel<typeof userTable>;

export const userRole = ["user", "student", "fellow", "admin"] as const;
export type UserRole = (typeof userRole)[number];

export type CourseTableRead = InferSelectModel<typeof courseTable>;
export type CourseTableWrite = InferInsertModel<typeof courseTable>;
export type CourseWithFellow = CourseTableRead & {
  fellow: SafeUser;
};
export type CourseWithFellowAndStudents = CourseTableRead & {
  fellow: SafeUser;
  students: SafeUser[];
};

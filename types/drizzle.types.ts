import { bundleTable, courseTable, userTable } from "@/db/db.schema";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";

export type CourseTable = InferSelectModel<typeof courseTable>;
export type BundleTable = InferInsertModel<typeof bundleTable>;

export type SafeUser = Omit<InferSelectModel<typeof userTable>, "passwordHash" | "googleId">;

export type UserWithSensitiveCols = InferSelectModel<typeof userTable>;

export type CourseWithSafeFellow = CourseTable & {
  fellow: SafeUser;
};

export type BundleWithCoursesNames = {
  id: number;
  name: string | null;
  category: string;
  attendance: string;
  year: number;
  cycle: string;
  deadline: Date;
  courses: {
    id: number;
    enTitle: string | null;
    arTitle: string | null;
  }[];
};

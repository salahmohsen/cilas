import { enrollmentTable } from "@/lib/drizzle/schema";
import { Type, type } from "arktype";
import { createInsertSchema } from "drizzle-arktype";
import { Enrollment } from "./courses.actions.types";

const insertEnrollmentSchema = createInsertSchema(enrollmentTable, {
  userId: (userId) => userId.atLeastLength(1).configure({ message: "User is required" }),
  paidAmount: (e: Type<string | number | "">) =>
    type("string.numeric.parse | number |''").pipe((e) =>
      e === "" || e === null ? undefined : e,
    ),
});

const enrollment = insertEnrollmentSchema.array().narrow((data, ctx) => {
  const userIds = data.map((e) => e.userId);
  const uniqueIds = new Set(userIds);

  if (userIds.length === uniqueIds.size) return true;

  const seen = new Set();

  data.forEach((enrollment, index) => {
    if (seen.has(enrollment.userId)) {
      return ctx.reject({
        path: ["enrollments", index, "userId"],
        actual: "",
        expected: "unique",
        message: "User must be unique across course enrollments",
      });
    }
    seen.add(enrollment.userId);
  });

  return true;
});

export const updateEnrollmentsSchema = {
  schema: type({
    enrollments: enrollment,
    courseId: type("number").moreThan(0).configure({ message: "Course id is required" }),
  }),

  defaults: (enrollments?: Enrollment[], courseId?: number) => ({
    enrollments: enrollments || [],
    courseId: courseId || 0,
  }),
};

export type UpdateEnrollmentsSchema = typeof updateEnrollmentsSchema.schema.infer;

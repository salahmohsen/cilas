"use server";

import db from "@/db/drizzle";
import {
  courseBundleAssociationTable,
  coursesBundleTable,
} from "@/db/db.schema";
import { Option } from "@/components/ui/multipleSelector";
import { bundleSchema } from "@/types/bundle.schema";
import { BundleTable } from "@/types/drizzle.types";

export type BundleState = {
  success?: boolean;
  error?: boolean;
  message: string;
};

export const createBundle = async (
  prevState: BundleState,
  formData: FormData,
): Promise<BundleState> => {
  const year = Number(formData.get("year") as string);
  const cycle = formData.get("cycle") as string;
  const category = formData.get("category") as string;
  const attendance = formData.get("attendance") as string;
  const deadline = new Date(formData.get("deadline") as string);
  const courses = JSON.parse(formData.get("courses") as string) as Option[];

  try {
    const parse = bundleSchema.safeParse({
      year,
      cycle,
      category,
      attendance,
      deadline,
      courses,
    });
    if (!parse.success) {
      throw new Error(
        `There is errors on these fields: ${parse.error?.errors.map((e) => e.path[0])}`,
      );
    }
  } catch (e) {
    if (e instanceof Error)
      return { success: false, error: true, message: e.message };
  }

  let bundleId: {
    id: number;
  }[];

  try {
    const values: BundleTable = {
      year,
      cycle,
      category,
      attendance,
      deadline,
    };

    bundleId = await db
      .insert(coursesBundleTable)
      .values(values)
      .returning({ id: coursesBundleTable.id });
  } catch (error) {
    if (error instanceof Error) return { error: true, message: error.message };
  }

  try {
    if (courses !== undefined && courses.length > 0) {
      courses.map(async (course) => {
        const values = {
          courseId: Number(course.value),
          bundleId: bundleId[0].id,
        };
        const stmt = await db
          .insert(courseBundleAssociationTable)
          .values(values);
      });
    }
    return { success: true, message: "Courses bundles created successfully" };
  } catch (error) {
    if (error instanceof Error) return { error: true, message: error.message };
  }

  return {
    error: true,
    message: "Unexpected error happened, Please try again later",
  };
};

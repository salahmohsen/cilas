"use server";

import db from "@/db/drizzle";
import { bundleTable, courseTable } from "@/db/db.schema";
import { Option } from "@/components/ui/multipleSelector";
import { bundleSchema } from "@/types/bundle.schema";
import { BundleTable } from "@/types/drizzle.types";
import { eq } from "drizzle-orm";

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

  let bundle: {
    bundleId: number;
  }[];
  // Create bundle and return success if no courses inserted
  try {
    const name = `${year} ${cycle} ${category}`;
    const values: BundleTable = {
      name,
      year,
      cycle,
      category,
      attendance,
      deadline,
    };

    bundle = await db
      .insert(bundleTable)
      .values(values)
      .returning({ bundleId: bundleTable.id });

    if (courses.length === 0)
      return { success: true, message: "bundle created successfully!" };
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message ===
        `duplicate key value violates unique constraint "course_bundle_name_unique"`
      ) {
        return {
          error: true,
          message: `${year} ${cycle} ${category} already exists!`,
        };
      } else {
        return { error: true, message: error.message };
      }
    }
  }

  // if courses length > 0 this should runs and try update courses with bundle IDs
  try {
    courses.map(async (course) => {
      const stmt = await db
        .update(courseTable)
        .set(bundle[0])
        .where(eq(courseTable.id, Number(course.value)));
    });
    return { success: true, message: "Courses bundles created successfully" };
  } catch (error) {
    if (error instanceof Error) return { error: true, message: error.message };
  }

  return {
    error: true,
    message: "Unexpected error happened, Please try again later",
  };
};

export type Bundle = {
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

export type GetBundles = {
  success?: boolean;
  error?: boolean;
  message: string;
  bundles?: Bundle[];
};

export const getBundles = async (): Promise<GetBundles> => {
  try {
    const bundles = await db.query.bundleTable.findMany({
      with: {
        courses: {
          columns: { id: true, enTitle: true, arTitle: true },
        },
      },
    });

    return { success: true, message: "bundles fetched successfully", bundles };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }
  return {
    success: false,
    message: "Unexpected error happened, please try again!",
  };
};

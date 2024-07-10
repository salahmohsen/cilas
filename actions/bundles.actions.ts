"use server";

import db from "@/db/drizzle";
import { bundleTable, courseTable } from "@/db/db.schema";
import { Option } from "@/components/ui/multipleSelector";
import { bundleSchema } from "@/types/bundle.schema";
import { BundleWithCoursesNames, BundleTable } from "@/types/drizzle.types";
import { eq } from "drizzle-orm";

export const getBundles = async () => {
  try {
    const bundles = await db.query.bundleTable.findMany({
      with: {
        courses: {
          columns: { id: true, enTitle: true, arTitle: true },
        },
      },
    });

    return {
      success: true,
      message: "bundles fetched successfully",
      bundles,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }
  return {
    success: false,
    message: "Unexpected error happened, please try again!",
  };
};
export type GetBundleById = {
  success?: boolean;
  error?: boolean;
  message: string;
  bundle?: Omit<BundleWithCoursesNames, "courses"> & {
    courses: { id: number; enTitle: string | null; arTitle: string | null }[];
  };
};

export const getBundleById = async (bundleId: number): Promise<GetBundleById> => {
  try {
    const bundle = await db.query.bundleTable.findFirst({
      with: {
        courses: {
          columns: { id: true, enTitle: true, arTitle: true },
        },
      },
      where: eq(bundleTable.id, bundleId),
    });
    if (!bundle) throw new Error("Bundle not found!");
    return {
      success: true,
      message: "bundle fetched successfully",
      bundle,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }
  return {
    success: false,
    message: "Unexpected error happened, please try again!",
  };
};

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
    if (e instanceof Error) return { success: false, error: true, message: e.message };
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

    bundle = await db.insert(bundleTable).values(values).returning({ bundleId: bundleTable.id });

    if (courses.length === 0) return { success: true, message: "bundle created successfully!" };
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

const deleteAssociatedCoursesToBundle = async (bundleId: number) => {
  try {
    const originalCoursesWithBundleId = await db.query.bundleTable.findFirst({
      with: {
        courses: {
          columns: { id: true },
        },
      },
      where: eq(bundleTable.id, bundleId),
      columns: { id: true },
    });
    const originalCoursesIds = originalCoursesWithBundleId?.courses ?? [];

    // Remove bundle association from original courses
    for (const { id } of originalCoursesIds) {
      await db.update(courseTable).set({ bundleId: null }).where(eq(courseTable.id, id)).execute();
    }
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "Unexpected error occurred!");
  }
};

export const updateBundleCourses = async (
  coursesToUpdate: Option[],
  bundleId: number,
): Promise<BundleState> => {
  console.log(coursesToUpdate);
  console.log(bundleId);
  try {
    await deleteAssociatedCoursesToBundle(bundleId);

    // Update new courses with bundle association
    for (const { value: id } of coursesToUpdate) {
      await db
        .update(courseTable)
        .set({ bundleId })
        .where(eq(courseTable.id, Number(id)))
        .execute();
    }

    return { success: true, message: "Bundle updated successfully" };
  } catch (e) {
    return {
      success: false,
      error: true,
      message: e instanceof Error ? e.message : "An unknown error occurred",
    };
  }
};

export const deleteBundle = async (bundleId: number): Promise<BundleState> => {
  try {
    await deleteAssociatedCoursesToBundle(bundleId);
    const result = await db.delete(bundleTable).where(eq(bundleTable.id, bundleId));

    return { success: true, message: "Bundle deleted successfully" };
  } catch (e) {
    return {
      error: true,
      message: e instanceof Error ? e.message : "Unexpected error occurred!",
    };
  }
};

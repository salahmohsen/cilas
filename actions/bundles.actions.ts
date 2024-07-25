"use server";

import db from "@/db/drizzle";
import { bundleTable, courseTable } from "@/db/db.schema";
import { Option } from "@/components/ui/multipleSelector";
import { bundleSchema } from "@/types/bundle.schema";
import {
  BundleWithCoursesNames,
  BundleTableWrite,
} from "@/types/drizzle.types";
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

export const getBundleById = async (
  bundleId: number,
): Promise<GetBundleById> => {
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

const parseBundleData = async (formData: FormData) => {
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
    return { courses, year, cycle, category, attendance, deadline };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }
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
  let bundle: {
    bundleId: number;
  }[];
  let name: string;
  try {
    const result = await parseBundleData(formData);
    if (result?.error || !result?.year) throw new Error(result?.message);

    const { year, cycle, category, attendance, deadline, courses } = result;
    name = `${year} ${cycle} ${category}`;

    const values: BundleTableWrite = {
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
    if (
      bundle instanceof Error &&
      bundle.message ===
        `duplicate key value violates unique constraint "course_bundle_name_unique"`
    ) {
      throw new Error(`${name} already exists!`);
    }
    if (courses.length === 0)
      return { success: true, message: "bundle created successfully!" };

    // if courses length > 0 this should runs and try update courses with bundle IDs

    courses.map(async (course) => {
      const stmt = await db
        .update(courseTable)
        .set(bundle[0])
        .where(eq(courseTable.id, Number(course.value)));
    });
    return { success: true, message: "bundle created successfully!" };
  } catch (error) {
    if (error instanceof Error) return { error: true, message: error.message };
  }
  return {
    error: true,
    message: "Unexpected error happened, Please try again later",
  };
};

export const editBundle = async (
  prevState: BundleState,
  formData: FormData,
): Promise<BundleState> => {
  try {
    const bundleId = Number(formData.get("bundleId"));
    if (isNaN(bundleId)) throw new Error("Bundle Id is not provided!");
    await deleteAssociatedCoursesToBundle(bundleId);

    const result = await parseBundleData(formData);
    if (result?.error || !result?.year) throw new Error(result?.message);

    const { year, cycle, category, attendance, deadline, courses } = result;
    const name = `${year} ${cycle} ${category}`;

    const values: BundleTableWrite = {
      name,
      year,
      cycle,
      category,
      attendance,
      deadline,
    };
    await updateBundleCourses(courses, bundleId);
    await db
      .update(bundleTable)
      .set(values)
      .where(eq(bundleTable.id, bundleId));

    return { success: true, message: "Changes saved successfully!" };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error ? error.message : "Unexpected Error Occurs",
    };
  }
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
      await db
        .update(courseTable)
        .set({ bundleId: null })
        .where(eq(courseTable.id, id))
        .execute();
    }
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Unexpected error occurred!",
    );
  }
};

export const updateBundleCourses = async (
  coursesToUpdate: Option[],
  bundleId: number,
): Promise<BundleState> => {
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
    const result = await db
      .delete(bundleTable)
      .where(eq(bundleTable.id, bundleId));

    return { success: true, message: "Bundle deleted successfully" };
  } catch (e) {
    return {
      error: true,
      message: e instanceof Error ? e.message : "Unexpected error occurred!",
    };
  }
};

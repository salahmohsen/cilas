"use server";

import {
  drizzleCourseFilter,
  formDataToCourseSchema,
} from "@/app/(dashboard)/admin/course-management/_lib/courses.actions.utils";
import { Option } from "@/components/ui/multipleSelector";
import { uploadImage, UploadingFolder } from "@/lib/cloudinary/cloudinary.utils";
import db, { performTransaction } from "@/lib/drizzle/drizzle";
import {
  courseFellowTable,
  courseTable,
  courseToCategory,
  enrollmentTable,
} from "@/lib/drizzle/schema";
import { ServerActionReturn } from "@/lib/types/server.actions";
import { safeJsonParse } from "@/lib/utils";
import { type } from "arktype";
import { and, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { CourseFormStateSchema } from "./course.schema";
import {
  CourseFormState,
  CourseTableWrite,
  DeleteCourseState,
  PrivateCourse,
  PublicCourse,
} from "./courses.actions.types";
import { CoursesFilter } from "./courses.slice.types";
import { UpdateEnrollmentsSchema } from "./update.enrollments.schema";

export async function createEditCourse(
  prevState: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  try {
    let { category, fellowId, ...courseFormObj } = formDataToCourseSchema(formData);

    const { isDraft, editMode, courseId } = CourseFormStateSchema.parse({
      isDraft: formData.get("draftMode"),
      editMode: formData.get("editMode"),
      courseId: formData.get("courseId"),
    });

    const imageUrl = await uploadImage(
      courseFormObj.featuredImage,
      UploadingFolder.feature,
    );

    const courseDB: CourseTableWrite = {
      ...courseFormObj,
      enContent: safeJsonParse(courseFormObj.enContent, "error parsing enContent"),
      arContent: safeJsonParse(courseFormObj.arContent, "error parsing arContent"),
      isDraft,
      featuredImage: imageUrl,
    };

    return await performTransaction(async (tx) => {
      // Create new course
      if (!editMode) {
        const [{ newCourseId }] = await tx
          .insert(courseTable)
          .values(courseDB)
          .returning({ newCourseId: courseTable.id });

        if (!newCourseId) throw new Error("Failed to create course record");

        // Create course-category relationship
        const [{ newCourseCategoryId }] = await tx
          .insert(courseToCategory)
          .values({ courseId: newCourseId, categoryId: category })
          .returning({ newCourseCategoryId: courseToCategory.categoryId });

        if (!newCourseCategoryId) {
          throw new Error("Failed to create category relationship");
        }

        // Create course-fellow relationship
        const [{ newCourseFellowId }] = await tx
          .insert(courseFellowTable)
          .values({ courseId: newCourseId, fellowId })
          .returning({ newCourseFellowId: courseFellowTable.fellowId });

        if (!newCourseFellowId) {
          throw new Error("Failed to create course-fellow relationship");
        }

        revalidatePath("/", "layout");

        return {
          success: true,
          message: "Course created successfully",
          data: newCourseId,
        };

        // Update existing course
      } else if (editMode && typeof courseId === "number") {
        const [{ updatedCourseId }] = await tx
          .update(courseTable)
          .set(courseDB)
          .where(eq(courseTable.id, courseId))
          .returning({ updatedCourseId: courseTable.id });

        if (!updatedCourseId) throw new Error("Failed to update course!");

        // Update course-category relationship
        const [{ updatedCategoryId }] = await tx
          .update(courseToCategory)
          .set({ categoryId: category })
          .where(eq(courseToCategory.courseId, updatedCourseId))
          .returning({ updatedCategoryId: courseToCategory.categoryId });

        if (!updatedCategoryId) throw new Error("Failed to update course category");

        // Update course-fellow relationship
        const [{ updatedFellowId }] = await tx
          .update(courseFellowTable)
          .set({ fellowId })
          .where(eq(courseFellowTable.courseId, updatedCourseId))
          .returning({ updatedFellowId: courseFellowTable.fellowId });

        if (!updatedFellowId) throw new Error("Failed to update course fellow");

        revalidatePath("/", "layout");

        return {
          success: true,
          message: "Course edited successfully",
          data: updatedCourseId,
        };
      }

      throw new Error("Invalid operation mode");
    });
  } catch (error) {
    console.error("Course operation failed:", error);
    if (error instanceof Error) {
      return {
        error: true,
        message: error.message,
        data: null,
      };
    }

    return {
      error: true,
      message: "Something happened wrong!",
      data: null,
    };
  }
}

export const fetchPublicCourse = async (
  courseId: number,
): Promise<ServerActionReturn & { data: PublicCourse | null }> => {
  try {
    if (!courseId || isNaN(courseId)) {
      return { error: true, message: "Invalid course ID", data: null };
    }

    const rawCourse = await db.query.courseTable.findFirst({
      where: eq(courseTable.id, courseId),
      with: {
        fellows: {
          with: {
            fellow: {
              columns: { passwordHash: false, googleId: false },
            },
          },
        },
        enrollments: {
          columns: { userId: true },
        },
        category: {
          with: {
            category: true,
          },
        },
      },
    });

    if (!rawCourse) throw new Error("Course not found!");

    const fellows = rawCourse.fellows.map((fellow) => fellow.fellow);
    const category = rawCourse.category?.category;
    const enrollmentCount = rawCourse.enrollments.length;

    if (!category)
      console.warn(
        `${rawCourse.enTitle || rawCourse.arTitle} with id: ${courseId} has no category assigned`,
      );

    const course = {
      ...rawCourse,
      category,
      fellows,
      enrollmentCount,
    };

    return { success: true, message: "course fetched successfully", data: course };
  } catch (error) {
    if (error instanceof Error)
      return { error: true, message: error.message, data: null };
    return { error: true, message: "Something went wrong!", data: null };
  }
};

export const fetchPrivateCourse = async ({
  slug,
  id,
}: {
  slug?: string;
  id?: number;
}): Promise<ServerActionReturn & { data: PrivateCourse | null }> => {
  try {
    let whereCondition;
    if (!slug && !id) throw new Error("No slug or id provided");
    if (id) whereCondition = eq(courseTable.id, id);
    if (slug) whereCondition = eq(courseTable.slug, slug);

    const rawCourse = await db.query.courseTable.findFirst({
      where: whereCondition,
      with: {
        fellows: {
          with: { fellow: { columns: { passwordHash: false, googleId: false } } },
        },
        enrollments: {
          with: {
            user: {
              columns: { googleId: false, passwordHash: false },
            },
          },
        },
        category: {
          with: {
            category: true,
          },
        },
      },
    });
    if (!rawCourse) throw new Error("course not found!");

    const category = rawCourse.category.category;
    const enrollmentCount = rawCourse.enrollments.length;
    const fellows = rawCourse.fellows.map((fellow) => fellow.fellow);

    if (!category)
      console.warn(`${rawCourse.enTitle || rawCourse.arTitle} has no category assigned`);

    return {
      success: true,
      message: "course fetched successfully!",
      data: { ...rawCourse, fellows, enrollmentCount, category },
    };
  } catch (error) {
    if (error instanceof Error)
      return { error: true, message: error.message, data: null };
    return { error: true, message: "Something wrong happened!", data: null };
  }
};

export const fetchPublicCourses = async ({
  filter,
  idArr,
  page = 1,
  pageSize = 10,
}: {
  filter?: CoursesFilter;
  idArr?: number[];
  page?: number;
  pageSize?: number;
}): Promise<ServerActionReturn & { data: PublicCourse[] | null }> => {
  try {
    const whereCondition =
      !filter && !idArr
        ? undefined
        : filter && idArr
          ? and(inArray(courseTable.id, idArr), drizzleCourseFilter(filter))
          : filter && !idArr
            ? drizzleCourseFilter(filter)
            : idArr
              ? inArray(courseTable.id, idArr)
              : undefined;

    const rawCourses = await db.query.courseTable.findMany({
      with: {
        fellows: {
          with: {
            fellow: {
              columns: { passwordHash: false, googleId: false },
            },
          },
        },
        enrollments: { columns: { userId: true } },
        category: {
          with: {
            category: true,
          },
        },
      },
      where: whereCondition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(courseTable.startDate), desc(courseTable.createdAt)],
    });

    const publicCourses: PublicCourse[] = rawCourses.map((course) => {
      let { enrollments, ...rest } = course;
      const enrollmentCount = enrollments.length;
      const fellows = rest.fellows.map((fellow) => fellow.fellow);
      const category = rest.category.category;

      return { ...rest, category, fellows, enrollmentCount };
    });

    return {
      success: true,
      message: "Courses fetched successfully",
      data: publicCourses,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message, data: null };
  }

  return {
    error: true,
    message: "Unexpected error happened, please try again!",
    data: null,
  };
};

export const fetchPrivateCourses = async ({
  filter,
  idArr,
  page = 1,
  pageSize = 10,
}: {
  filter?: CoursesFilter;
  idArr?: number[];
  page?: number;
  pageSize?: number;
}): Promise<ServerActionReturn & { data: PrivateCourse[] | null }> => {
  try {
    const whereCondition =
      !filter && !idArr
        ? undefined
        : filter && idArr
          ? and(inArray(courseTable.id, idArr), drizzleCourseFilter(filter))
          : filter && !idArr
            ? drizzleCourseFilter(filter)
            : idArr
              ? inArray(courseTable.id, idArr)
              : undefined;

    const rawCourses = await db.query.courseTable.findMany({
      with: {
        fellows: {
          with: {
            fellow: {
              columns: { passwordHash: false, googleId: false },
            },
          },
        },
        enrollments: {
          with: {
            user: {
              columns: { googleId: false, passwordHash: false },
            },
          },
        },
        category: {
          with: {
            category: true,
          },
        },
      },
      where: whereCondition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(courseTable.startDate), desc(courseTable.createdAt)],
    });

    const PrivateCourses: PrivateCourse[] = rawCourses.map((course) => {
      const enrollmentCount = course.enrollments.length;
      const fellows = course.fellows.map((fellow) => fellow.fellow);
      const category = course.category.category;
      return { ...course, category, fellows, enrollmentCount };
    });

    return {
      success: true,
      message: "Courses fetched successfully",
      data: PrivateCourses,
    };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message, data: null };
  }

  return {
    error: true,
    message: "Unexpected error happened, please try again!",
    data: null,
  };
};

export const getCategoriesOptions = async (): Promise<
  ServerActionReturn & { data: Option[] | null }
> => {
  try {
    const categories = await db.query.courseCategoriesTable.findMany({
      columns: { id: true, enName: true },
    });
    if (categories.length === 0) throw new Error("No categories found");
    const options = categories.map((category) => {
      return {
        value: String(category.id),
        label: category.enName,
      };
    });
    return { success: true, message: "categories fetched successfully!", data: options };
  } catch (error) {
    if (error instanceof Error)
      return { error: true, message: error.message, data: null };
    return {
      error: true,
      message: "Something wen wrong with getting categories",
      data: null,
    };
  }
};

export const searchCoursesNames = async (value: string = "") => {
  const data = await db.query.courseTable.findMany({
    columns: {
      id: true,
      enTitle: true,
      arTitle: true,
    },
    where: or(
      ilike(courseTable.enTitle, `%${value.toLowerCase()}%`),
      ilike(courseTable.arTitle, `%${value.toLowerCase()}%`),
    ),
  });

  const coursesNames: Option[] = data.map((course) => {
    if (course.enTitle) return { label: course.enTitle, value: course.id.toString() };
    else {
      return { label: course.arTitle!, value: course.id.toString() };
    }
  });

  return coursesNames;
};

export const deleteCourse = async (
  prevState: DeleteCourseState,
  formData: FormData,
): Promise<DeleteCourseState> => {
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string") return { error: true, message: "invalid course id!" };

  try {
    const statement = await db
      .delete(courseTable)
      .where(eq(courseTable.id, Number(courseId)));

    revalidatePath("/", "layout");

    return {
      success: true,
      deletedId: Number(courseId),
      message: "Course deleted successfully!",
    };
  } catch (e) {
    console.error(e);
    return {
      error: false,
      message: "Oops! Course deletion failed. Please try again later.",
    };
  }
};

export const updateEnrollments = async (
  prevState: ServerActionReturn,
  formData: FormData,
): Promise<ServerActionReturn> => {
  try {
    const { courseId: rawCourseId, enrollments: rawEnrollments } =
      safeJsonParse<UpdateEnrollmentsSchema>(
        formData.get("data"),
        "Failed to parse data:",
      );

    const enrollmentsClient = {
      courseId: rawCourseId,
      enrollments: rawEnrollments.map((enrollment) => ({
        ...enrollment,
        enrollmentDate: enrollment.enrollmentDate && new Date(enrollment.enrollmentDate),
        paymentDate: enrollment.paymentDate && new Date(enrollment.paymentDate),
      })),
    };

    if (enrollmentsClient instanceof type.errors) {
      return {
        error: true,
        message: `Validation error: ${enrollmentsClient.summary}`,
      };
    }

    const { enrollments, courseId } = enrollmentsClient;

    if (enrollments.length === 0) {
      return await removeAllEnrollments(rawCourseId);
    }

    return await performTransaction(async (tx) => {
      const deleteResult = await tx
        .delete(enrollmentTable)
        .where(eq(enrollmentTable.courseId, courseId));

      if (deleteResult instanceof Error) {
        throw new Error(`Failed to clear existing enrollments: ${deleteResult.message}`);
      }
      console.info(`Removed existing enrollments for course ${courseId}`);

      if (enrollments.length > 0) {
        const insertResult = await tx.insert(enrollmentTable).values(enrollments);

        if (insertResult instanceof Error) {
          throw new Error(`Failed to add new enrollments: ${insertResult.message}`);
        }

        console.info(`Added ${enrollments.length} enrollments for course ${courseId}`);
      }
      return {
        success: true,
        message: `Enrollments updated successfully!`,
        data: { courseId: courseId, count: enrollments.length },
      };
    });
  } catch (error) {
    console.error("Enrollment update error:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      error: true,
      message:
        error instanceof Error
          ? `Update failed: ${error.message}`
          : "Unknown error during enrollment update",
    };
  }
};

async function removeAllEnrollments(courseId: number): Promise<ServerActionReturn> {
  const startTime = performance.now();

  try {
    return await performTransaction(async (tx) => {
      const deleteResult = await tx
        .delete(enrollmentTable)
        .where(eq(enrollmentTable.courseId, courseId));

      if (deleteResult instanceof Error) {
        throw new Error(`Failed to remove enrollments: ${deleteResult.message}`);
      }

      const duration = Math.round(performance.now() - startTime);
      console.info(`Successfully removed all enrollments for course ${courseId}`);

      return {
        success: true,
        message: `All enrollments removed successfully for course ${courseId} (${duration}ms)`,
        data: { courseId, count: 0 },
      };
    });
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);

    console.error("Error removing all enrollments:", {
      courseId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });

    return {
      error: true,
      message:
        error instanceof Error
          ? `Failed to remove enrollments: ${error.message}`
          : "Unknown error while removing enrollments",
    };
  }
}

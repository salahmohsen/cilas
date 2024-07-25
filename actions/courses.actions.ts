"use server";

import db from "@/db/drizzle";
import { courseTable } from "@/db/db.schema";
import { courseSchema } from "@/types/course.schema";
import {
  eq,
  desc,
  asc,
  or,
  and,
  like,
  ilike,
  isNull,
  inArray,
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { uploadImage } from "@/lib/cloudinary.utils";
import {
  courseSchemaToDbSchema,
  formDataToCourseSchema,
} from "@/lib/actions.utils";
import { Option } from "@/components/ui/multipleSelector";
import { CoursesFilter } from "@/types/manage.courses.types";
import { coursesFilter } from "@/lib/drizzle.utils";

export type CourseFormState = {
  success?: boolean;
  error?: boolean;
  courseId?: number;
  message: string;
};

export async function createEditCourse(
  prevState: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  let formObj = formDataToCourseSchema(formData);
  const draftMode: boolean = JSON.parse(formData.get("draftMode") as string);
  const editMode: boolean = JSON.parse(formData.get("editMode") as string);
  let courseId: string | number = formData.get("courseId") as string;
  if (courseId && typeof courseId === "string") {
    courseId = Number(courseId) as number;
  }
  // parse the data
  try {
    const parse = courseSchema.safeParse(formObj);
    if (!parse.success) {
      console.log(parse.error.errors);
      throw new Error(
        `An error occurred while processing the form values: ${parse.error?.errors.map((e) => e.path[0])}`,
      );
    }
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: error.message,
      };
  }

  // uploading the image if data parsing is succeed
  const imageUrl = await uploadImage(formObj.featuredImage);
  if (imageUrl instanceof Error)
    return {
      error: true,
      message: "Image Uploading Failed, please try again later!",
    };

  // Initialize the values for the database
  const dbObj = courseSchemaToDbSchema(formObj, draftMode, imageUrl as string);

  // Publish new course
  if (!editMode) {
    try {
      // For testing
      // const result = Array(30)
      //   .fill("test")
      //   .map(async (_, index) => {
      //     await db
      //       .insert(courseTable)
      //       .values({ ...dbObj, enTitle: `Test draft ${index}` })
      //       .returning({ Id: courseTable.id });
      //   });

      const result = await db
        .insert(courseTable)
        .values(dbObj)
        .returning({ Id: courseTable.id });

      revalidatePath("/", "layout");
      return {
        success: true,
        message: "Course published successfully",
        courseId: result[0].Id,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: true,
          message: `Oops! Course addition failed. Please try again. ${error.message}`,
        };
    }

    // Edit existing course
  } else if (editMode && typeof courseId === "number") {
    try {
      const result = await db
        .update(courseTable)
        .set(dbObj)
        .where(eq(courseTable.id, courseId))
        .returning({ Id: courseTable.id });

      revalidatePath("/", "layout");
      return {
        success: true,
        message: "Course edited successfully",
        courseId: result[0].Id,
      };
    } catch (error) {
      if (error instanceof Error)
        return {
          error: true,
          message: `Oops! Course edit failed. Please try again. ${error.message}`,
        };
    }
  }
  return {
    error: true,
    message: "Something went wrong, please try again later",
  };
}

export const getSafeCourses = async (
  filter?: CoursesFilter,
  id?: number,
  idArr?: number[],
  page: number = 1,
  pageSize: number = 10,
) => {
  const whereCondition =
    !filter && !id && !idArr
      ? undefined
      : idArr
        ? inArray(courseTable.id, idArr)
        : id !== undefined && filter !== undefined
          ? and(coursesFilter(filter), eq(courseTable.id, id))
          : id !== undefined
            ? eq(courseTable.id, id)
            : filter !== undefined
              ? coursesFilter(filter)
              : undefined;

  try {
    const courses = await db.query.courseTable.findMany({
      with: {
        fellow: {
          columns: { googleId: false, passwordHash: false },
        },
      },
      where: whereCondition,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      orderBy: [desc(courseTable.startDate), desc(courseTable.createdAt)],
    });

    return { success: true, message: "Courses fetched successfully", courses };
  } catch (e) {
    if (e instanceof Error) return { error: true, message: e.message };
  }

  return {
    error: true,
    message: "Unexpected error happened, please try again!",
  };
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
    if (course.enTitle)
      return { label: course.enTitle, value: course.id.toString() };
    else {
      return { label: course.arTitle!, value: course.id.toString() };
    }
  });

  return coursesNames;
};

export const getUnbundledCourses = async (
  query: string,
  defaultCourses?: Option[],
) => {
  const data = await db.query.courseTable.findMany({
    columns: {
      id: true,
      enTitle: true,
      arTitle: true,
    },
    where: and(
      isNull(courseTable.bundleId),
      eq(courseTable.draftMode, false),
      or(
        ilike(courseTable.enTitle, `%${query.toLowerCase()}%`),
        ilike(courseTable.arTitle, `%${query.toLowerCase()}%`),
      ),
    ),
  });
  const coursesNames: Option[] = data.map((course) => {
    if (course.enTitle)
      return { label: course.enTitle, value: course.id.toString() };
    else {
      return { label: course.arTitle!, value: course.id.toString() };
    }
  });
  return [...coursesNames, ...(defaultCourses ?? [])];
};

export const getCourseById = async (courseId: number) => {
  let course = await db.query.courseTable.findFirst({
    where: eq(courseTable.id, courseId),
    with: {
      fellow: {
        columns: { passwordHash: false, googleId: false },
      },
    },
  });

  if (course)
    return {
      ...course,
      timeSlot: {
        from: new Date(course.timeSlot.from),
        to: new Date(course.timeSlot.to),
      },
    };
};

type DeleteCourseState = {
  success?: boolean;
  error?: boolean;
  deletedId?: number;
  message?: string;
};
export const deleteCourse = async (
  prevState: DeleteCourseState,
  formData: FormData,
): Promise<DeleteCourseState> => {
  const courseId = formData.get("courseId");
  if (typeof courseId !== "string")
    return { error: true, message: "invalid course id!" };

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

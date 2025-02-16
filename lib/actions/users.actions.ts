"use server";

import { Option } from "@/components/ui/multipleSelector";

import { enrollmentTable, userTable } from "@/lib/db/db.schema";
import db from "@/lib/db/drizzle";
import {
  addStudentSchema,
  fellowSchema,
  FellowSchema,
  userProfileSchema,
} from "@/lib/types/forms.schema";
import { eq, ilike, or } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import { validateRequest } from "../apis/auth.api";
import { userLocalInfo } from "../types/drizzle.types";
import { BasePrevState, FellowState } from "../types/users.actions.types";

export const addUser = async (id: string, email: string, passwordHash: string) => {
  try {
    // TODO: Change default role later
    const stmt = db.insert(userTable).values({ id, email, passwordHash, role: "admin" });
    await db.execute(stmt);
    return { success: "user made!" };
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
  }
};

export const addFellow = async (
  prevState: FellowState,
  formData: FormData,
): Promise<FellowState> => {
  const formEntries: FellowSchema = Object.fromEntries(formData) as FellowSchema;

  try {
    const parse = fellowSchema.schema.safeParse(formEntries);
    if (!parse.success)
      throw new Error(
        `An error occurred while processing the form values: ${parse.error.errors.map((e) => e.path[0])}`,
      );
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: error.message,
      };
  }

  try {
    const id = generateIdFromEntropySize(10); // 16 characters long
    const fellow = await db
      .insert(userTable)
      .values({ id, ...formEntries, role: "fellow" })
      .returning();

    const { passwordHash, googleId, ...safeFellow } = fellow[0];

    return {
      success: true,
      message: "Fellow added successfully",
      fellow: safeFellow,
    };
  } catch (error) {
    if (error instanceof Error)
      if (
        error.message ===
        'duplicate key value violates unique constraint "user_email_unique"'
      ) {
        try {
          const fellow = await db
            .update(userTable)
            .set({ role: "fellow" })
            .where(eq(userTable.email, formEntries.email))
            .returning();

          const { googleId, passwordHash, ...safeFellow } = fellow[0];

          return {
            success: true,
            message:
              "This user was already in the database and converted to fellow successfully",
            fellow: safeFellow,
          };
        } catch (error) {
          if (error instanceof Error) return { error: true, message: error.message };
        }
      } else {
        return { error: true, message: error.message };
      }
  }

  return { error: true, message: "An unexpected error occurred" };
};

export const getUsersByRole = async (role: "user" | "fellow" | "admin") => {
  const users = await db.query.userTable.findMany({
    where: eq(userTable.role, role),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  return users;
};

export const getUsersNamesByRole = async (role: "user" | "fellow" | "admin") => {
  const users = await db.query.userTable.findMany({
    where: eq(userTable.role, role),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return users;
};

export const getUserById = async (id: string): Promise<userLocalInfo | undefined> => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.id, id),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  return user;
};

export const getUserByEmail = async (email: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.email, email),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  return user;
};

// @important This will return password included
export const _getUserByEmail = async (email: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.email, email),
  });

  return user;
};

export const getCurrentUserInfo = async () => {
  const { user } = await validateRequest();
  return user?.id ? getUserById(user.id) : null;
};

export const searchUsers = async (query: string): Promise<Option[]> => {
  const sanitizedQuery = `%${query.toLowerCase()}%`;

  const users = await db.query.userTable.findMany({
    columns: {
      id: true,
      firstName: true,
      lastName: true,
    },
    where: or(
      ilike(userTable.firstName, sanitizedQuery),
      ilike(userTable.lastName, sanitizedQuery),
    ),
  });

  const dataFormatted = users.map((user) => ({
    value: user.id,
    label: `${user.firstName} ${user.lastName}`,
  }));

  return dataFormatted;
};

export const updateCourseEnrollments = async (
  prevState: BasePrevState,
  formData: FormData,
): Promise<BasePrevState> => {
  const students = JSON.parse(formData.get("students") as string);
  const courseId = Number(formData.get("courseId"));

  console.log("students", students);
  console.log("courseId", courseId);

  try {
    // Validate input
    const parse = addStudentSchema.schema.safeParse({ students, courseId });
    if (!parse.success) throw new Error("Invalid form data");

    // Convert to simple array of user IDs
    const newStudentIds = students.map((s: { value: string }) => s.value);

    // 1. First delete existing enrollments
    const deleteResult = await db
      .delete(enrollmentTable)
      .where(eq(enrollmentTable.courseId, courseId));

    if (deleteResult instanceof Error) {
      throw new Error("Failed to clear existing enrollments");
    }

    // 2. Insert new enrollments if any exist
    if (newStudentIds.length > 0) {
      const insertResult = await db
        .insert(enrollmentTable)
        .values(
          newStudentIds.map((userId) => ({
            userId,
            courseId,
            enrollmentDate: new Date(),
          })),
        )
        .onConflictDoNothing();

      if (insertResult instanceof Error) {
        throw new Error("Failed to add new enrollments");
      }
    }

    return { success: true, message: "Enrollments updated successfully!" };
  } catch (error) {
    console.error("Enrollment update error:", error);
    return {
      error: true,
      message:
        error instanceof Error
          ? `Update failed: ${error.message}`
          : "Unknown error during enrollment update",
    };
  }
};

/**
 *
 * @param courseId course id
 * @param boolean if true, return full user data, if false, return only id and name, default is false
 * @returns Option[] | UserWithProtectedFields[]
 */

type studentReturnType<T> = T extends true ? userLocalInfo[] : Option[];

export const getStudentsByCourseId = async <T extends boolean>(
  courseId: number,
  fullData: boolean = false,
): Promise<studentReturnType<T>> => {
  const students = await db.query.enrollmentTable.findMany({
    where: eq(enrollmentTable.courseId, courseId),
  });
  const studentsIds = students.map((student) => student.userId);

  const studentsData = await Promise.all(
    studentsIds.map((studentId) => getUserById(studentId)),
  );

  const studentsOptions = studentsData
    .map((student) => {
      if (student) {
        return {
          value: student.id,
          label: `${student.firstName} ${student.lastName}`,
        };
      }
    })
    .filter(Boolean) as Option[];

  if (fullData) {
    return studentsData.filter(
      (student): student is userLocalInfo => student !== undefined,
    ) as studentReturnType<T>;
  } else {
    return studentsOptions as studentReturnType<T>;
  }
};

export const updateUserInfo = async (
  prevState: BasePrevState,
  formData: FormData,
): Promise<BasePrevState> => {
  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const userName = formData.get("userName") as string;
  const avatar = formData.get("avatar") as string;
  const bio = formData.get("bio") as string;
  const email = formData.get("email") as string;
  const tel = formData.get("tel") as string;

  try {
    const parse = userProfileSchema.schema.safeParse({
      id,
      firstName,
      lastName,
      userName,
      avatar,
      bio,
      email,
      tel,
    });

    if (!parse.success) throw new Error(`Invalid form data ${parse.error} `);

    const stmt = await db
      .update(userTable)
      .set({ firstName, lastName, avatar, bio, email, tel })
      .where(eq(userTable.id, id))
      .returning();

    return { success: true, message: "user profile updated successfully!" };
  } catch (error) {
    console.error("update user info failed: ", error);
    return {
      error: true,
      message:
        error instanceof Error
          ? `Update failed: ${error.message}`
          : "Unknown error during user profile update",
    };
  }
};

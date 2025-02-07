"use server";

import { Option } from "@/components/ui/multipleSelector";
import { enrollmentTable, userTable } from "@/lib/db/db.schema";
import db from "@/lib/db/drizzle";
import { addStudentSchema, fellowSchema, FellowSchema } from "@/lib/types/forms.schema";
import { eq, ilike, or } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import { revalidatePath } from "next/cache";
import { validateRequest } from "../apis/auth.api";
import { AddStudentToCourseState, FellowState } from "../types/users.actions.types";

export const addUser = async (id: string, email: string, passwordHash: string) => {
  try {
    const stmt = db.insert(userTable).values({ id, email, passwordHash, role: "user" });
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

export const getUserById = async (userId: string) => {
  const user = db.query.userTable.findFirst({
    where: eq(userTable.id, userId),
    columns: {
      passwordHash: false,
      googleId: false,
    },
  });

  revalidatePath("/courses");
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

export const addStudentToCourse = async (
  prevState: AddStudentToCourseState,
  formDate: FormData,
): Promise<AddStudentToCourseState> => {
  console.log("formDate", formDate);
  const students = JSON.parse(formDate.get("students") as string);
  const courseId = Number(formDate.get("courseId"));

  try {
    const parse = addStudentSchema.schema.safeParse({ students, courseId });
    if (!parse.success) throw new Error("Failed to parse the form data");

    const studentsIds: string[] = students.map((student: { value: string }) =>
      String(student.value),
    );

    // console.log(
    //   "db valuse",
    //   studentsIds.map((userId) => ({ userId, courseId })),
    // );

    const result = await db
      .insert(enrollmentTable)
      .values(studentsIds.map((userId) => ({ userId, courseId })))
      .onConflictDoNothing();

    if (result instanceof Error)
      throw new Error("Failed to add students to the database");
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: `An error occurred while processing adding students: ${error.message}`,
      };
  }

  return { success: true, message: "Students added successfully!" };
};

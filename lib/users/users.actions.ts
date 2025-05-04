"use server";

import { Option } from "@/components/ui/multipleSelector";

import db from "@/lib/drizzle/drizzle";

import fellowSchema, {
  FellowSchema,
} from "@/app/(dashboard)/admin/course-management/_lib/fellow.schema";
import profileSchema from "@/app/(dashboard)/admin/course-management/_lib/profile.schema";
import { ComboboxOption } from "@/components/ui/combobox";
import { and, eq, ilike, or, SQL } from "drizzle-orm";
import { generateIdFromEntropySize } from "lucia";
import { validateRequest } from "../../app/(Auth)/_lib/auth.lucia";
import { enrollmentTable, userTable } from "../drizzle/schema";
import { ServerActionReturn } from "../types/server.actions";
import { BasePrevState, FellowState, SafeUser, UserRole } from "./users.actions.types";

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

type User = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  avatar?: string | null;
};

export const searchUsers = async (
  query?: string,
  role?: UserRole,
): Promise<ServerActionReturn & { data: ComboboxOption[] | null }> => {
  try {
    let users: User[];

    const whereConditions: SQL<unknown>[] = [];

    if (role) {
      whereConditions.push(eq(userTable.role, role));
    }

    // Add search filter if query is provided and not empty
    if (query && query.trim()) {
      whereConditions.push(
        // @ts-expect-error
        or(
          ilike(userTable.firstName, `%${query}%`),
          ilike(userTable.lastName, `%${query}%`),
        ),
      );
    }

    // Execute query with all conditions
    if (whereConditions.length > 0) {
      users = await db.query.userTable.findMany({
        where: and(...whereConditions),
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
        // Limit to 5 items when query is empty or not provided
        limit: !query || !query.trim() ? 5 : undefined,
      });
    } else {
      users = await db.query.userTable.findMany({
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
        // Limit to 5 items when query is empty or not provided
        limit: 5,
      });
    }

    const result: ComboboxOption[] = users.map((user) => ({
      value: user.id,
      label: `${user.firstName} ${user.lastName}`,
      avatar: user.avatar,
    }));

    return { success: true, message: "Users fetched successfully!", data: result };
  } catch (error) {
    if (error instanceof Error)
      return {
        error: true,
        message: error.message,
        data: null,
      };
    return {
      error: true,
      message: "Something went wrong with searching users",
      data: null,
    };
  }
};

export const getUserById = async (id: string): Promise<SafeUser | undefined> => {
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

/**
 *
 * @param courseId course id
 * @param boolean if true, return full user data, if false, return only id and name, default is false
 * @returns Option[] | UserWithProtectedFields[]
 */

type studentReturnType<T> = T extends true ? SafeUser[] : Option[];

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
      (student): student is SafeUser => student !== undefined,
    ) as studentReturnType<T>;
  } else {
    return studentsOptions as studentReturnType<T>;
  }
};

export const updateUserInfo = async (
  prevState: BasePrevState,
  formData: FormData,
): Promise<ServerActionReturn> => {
  const id = formData.get("id") as string;
  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const userName = formData.get("userName") as string;
  const avatar = formData.get("avatar") as string;
  const bio = formData.get("bio") as string;
  const email = formData.get("email") as string;
  const tel = formData.get("tel") as string;

  try {
    const parse = profileSchema.schema.parse({
      id,
      firstName,
      lastName,
      userName,
      avatar,
      bio,
      email,
      tel,
    });

    const [{ userID }] = await db
      .update(userTable)
      .set({ firstName, lastName, avatar, bio, email, tel })
      .where(eq(userTable.id, id))
      .returning({ userID: userTable.id });

    return { success: true, message: "user profile updated successfully!", data: userID };
  } catch (error) {
    console.error("update user info failed: ", error);
    return {
      error: true,
      message:
        error instanceof Error
          ? `Update failed: ${error.message}`
          : "Unknown error during user profile update",
      data: null,
    };
  }
};

export const fetchAvatar = async (id: string): Promise<ServerActionReturn> => {
  try {
    const avatar = await db.query.userTable.findFirst({
      where: eq(userTable.id, id),
      columns: {
        avatar: true,
      },
    });
    return {
      success: true,
      message: "Avatar fetched successfully!",
      data: avatar?.avatar,
    };
  } catch (error) {
    return {
      error: true,
      message:
        error instanceof Error
          ? error.message
          : "Something went wrong while fetching avatar",
      data: null,
    };
  }
};

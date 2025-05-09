import { env } from "@/env";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import courseTable from "./course";
import enrollmentTable from "./enrollment";
import blogAuthorsTable from "./post.author.to.role";
import sessionTable from "./session";

export const userRoleEnum = pgEnum('role', ['admin', "fellow", 'user']);


const userTable = pgTable("user", {
  id: text("id").primaryKey(),
  googleId: text("google_id").unique(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  userName: varchar("user_name", { length: 50 }).unique(),
  passwordHash: text("password_hash"),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  tel: varchar("tel", { length: 20 }),
  avatar: text("avatar"),
  bio: text("bio"),
  role: userRoleEnum("role").notNull().default(env.NEW_USER_ROLE), 
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userRelations = relations(userTable, ({ many }) => ({
  sessions: many(sessionTable),
  enrollments: many(enrollmentTable),
  courses: many(courseTable, { relationName: "fellow" }),
  postAuthors: many(blogAuthorsTable),
}));

export default userTable;

import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { userRole } from "../../types/drizzle.types";
import courseTable from "./course";
import enrollmentTable from "./enrollment";
import blogAuthorsTable from "./post.author.to.role";
import sessionTable from "./session";

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
  role: text("role", { enum: userRole }).notNull().default("admin"), // Change to user in production
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

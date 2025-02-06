import { JSONContent } from "@tiptap/core";
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  json,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { userRole } from "../types/drizzle.types";

export const userTable = pgTable("user", {
  id: text("id").primaryKey(),
  googleId: text("google_id").unique(),
  email: text("email").unique(),
  userName: text("user_name").unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  tel: text("tel"),
  avatar: text("avatar"),
  bio: text("bio"),
  role: text("role", { enum: userRole }).notNull().default("admin"), // Change to user in production
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userRelations = relations(userTable, ({ many }) => ({
  sessions: many(sessionTable),
  enrollments: many(enrollmentTable),
  blogAuthors: many(blogAuthorsTable),
}));

export const sessionTable = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id),
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const courseTable = pgTable("course", {
  id: serial("id").primaryKey(),
  draftMode: boolean("draft_mode").notNull(),
  enTitle: text("en_title"),
  enContent: json("en_content").$type<JSONContent>(),
  arTitle: text("ar_title"),
  arContent: json("ar_content").$type<JSONContent>(),
  featuredImage: text("featured_image"),
  fellowId: text("fellow_id")
    .notNull()
    .references(() => userTable.id),
  category: text("category").notNull(),
  isRegistrationOpen: boolean("registration_status").notNull(),
  attendance: text("attendance").notNull(),
  suggestedPrice: json("suggestedPrice").notNull().$type<[number, number]>(),
  days: json("days").$type<
    {
      label: string;
      value: string;
      disable?: boolean;
    }[]
  >(),
  startDate: date("starting_date", { mode: "date" }).notNull(),
  endDate: date("ending_date", { mode: "date" }).notNull(),
  timeSlot: json("time_slot").notNull().$type<{ from: Date; to: Date }>(),
  students: json("students"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  bundleId: integer("bundle_id").references(() => bundleTable.id),
});

export const courseRelations = relations(courseTable, ({ one, many }) => ({
  fellow: one(userTable, {
    fields: [courseTable.fellowId],
    references: [userTable.id],
  }),
  enrollments: many(enrollmentTable),
  bundle: one(bundleTable, {
    fields: [courseTable.bundleId],
    references: [bundleTable.id],
  }),
}));

export const bundleTable = pgTable("course_bundle", {
  id: serial("id").primaryKey(),
  name: text("name").unique(),
  year: integer("year").notNull(),
  cycle: text("cycle").notNull(),
  category: text("category").notNull(),
  attendance: text("attendance").notNull(),
  deadline: date("deadline", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bundleTableRelations = relations(bundleTable, ({ many }) => ({
  courses: many(courseTable),
}));

export const enrollmentTable = pgTable(
  "course_enrollment",
  {
    courseId: integer("course_id")
      .notNull()
      .references(() => courseTable.id),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id),
    enrollmentDate: timestamp("enrollment_date").notNull().defaultNow(),
  },
  (t) => ({
    id: primaryKey({ columns: [t.courseId, t.userId] }),
  }),
);

export const courseEnrollmentRelations = relations(enrollmentTable, ({ one }) => ({
  course: one(courseTable, {
    fields: [enrollmentTable.courseId],
    references: [courseTable.id],
  }),
  user: one(userTable, {
    fields: [enrollmentTable.userId],
    references: [userTable.id],
  }),
}));

export const blogTable = pgTable("blog", {
  id: serial("id").primaryKey(),
  draftMode: boolean("draft_mode").notNull(),
  enTitle: text("en_title"),
  enContent: text("en_content"),
  arTitle: text("ar_title"),
  arContent: text("ar_content"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const blogAuthorsTable = pgTable("blog_authors", {
  blogId: integer("blog_id").references(() => blogTable.id),
  authorId: text("author_id").references(() => userTable.id),
});

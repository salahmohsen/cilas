import { relations } from "drizzle-orm";
import {
  text,
  boolean,
  pgTable,
  serial,
  json,
  timestamp,
  integer,
  date,
} from "drizzle-orm/pg-core";

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
  role: text("role", { enum: ["user", "fellow", "admin"] })
    .notNull()
    .default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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
  enContent: text("en_content"),
  arTitle: text("ar_title"),
  arContent: text("ar_content"),
  image: text("image_url"),
  fellowId: text("fellow_id")
    .notNull()
    .references(() => userTable.id),
  category: text("category").notNull(),
  isRegistrationOpen: boolean("registration_status").notNull(),
  attendance: text("attendance").notNull(),
  price: text("price"),
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
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const courseEnrollmentTable = pgTable("course_enrollment", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courseTable.id),
  userId: text("user_id")
    .notNull()
    .references(() => userTable.id),
  enrollmentDate: timestamp("enrollment_date").notNull().defaultNow(),
});

export const coursesBundleTable = pgTable("course_bundle", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  cycle: text("cycle").notNull(),
  category: text("category").notNull(),
  attendance: text("attendance").notNull(),
  deadline: date("deadline", { mode: "date" }).notNull(),
});

export const courseBundleAssociationTable = pgTable(
  "course_bundle_association",
  {
    id: serial("id").primaryKey(),
    courseId: integer("course_id")
      .notNull()
      .references(() => courseTable.id),
    bundleId: integer("bundle_id")
      .notNull()
      .references(() => coursesBundleTable.id),
  },
);

// Relations

export const courseRelations = relations(courseTable, ({ one, many }) => ({
  fellow: one(userTable, {
    fields: [courseTable.fellowId],
    references: [userTable.id],
  }),
  enrollments: many(courseEnrollmentTable),
  bundleAssociations: one(courseBundleAssociationTable),
}));

export const courseEnrollmentRelations = relations(
  courseEnrollmentTable,
  ({ one }) => ({
    course: one(courseTable, {
      fields: [courseEnrollmentTable.courseId],
      references: [courseTable.id],
    }),
    user: one(userTable, {
      fields: [courseEnrollmentTable.userId],
      references: [userTable.id],
    }),
  }),
);

export const bundlesRelations = relations(
  courseBundleAssociationTable,
  ({ one, many }) => ({
    bundle: one(coursesBundleTable, {
      fields: [courseBundleAssociationTable.bundleId],
      references: [coursesBundleTable.id],
    }),
    courses: many(courseTable),
  }),
);

import { relations } from "drizzle-orm";
import {
  text,
  boolean,
  pgTable,
  serial,
  json,
  timestamp,
} from "drizzle-orm/pg-core";

export const userTable = pgTable("user", {
  id: text("id").primaryKey(),
  googleId: text("google_id").unique(),
  email: text("email").unique(),
  userName: text("user_name").unique(),
  password_hash: text("password_hash"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  tel: text("tel"),
  avatar: text("avatar"),
  bio: text("bio"),
  role: text("role").notNull().default("user"),
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

export const categoryTable = pgTable("course_category", {
  id: serial("id").primaryKey(),
  category: text("category"),
});

export const courseTable = pgTable("course", {
  id: serial("id").primaryKey(),
  draftMode: boolean("draft_mode").notNull(),
  enTitle: text("en_title"),
  enContent: text("en_content"),
  arTitle: text("ar_title"),
  arContent: text("ar_content"),
  image: text("image_url"),
  authorId: text("author_id")
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
  dateRange: json("date_range").notNull().$type<{ from: Date; to: Date }>(),
  timeSlot: json("time_slot").notNull().$type<{ from: Date; to: Date }>(),
  students: json("students"), // ToDo one-to-many course -> users
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const coursesBundleTable = pgTable("course_bundle", {
  id: serial("id").primaryKey(),
  name: text("bundle_name"),
  bundleDescription: text("bundle_description").notNull(),
});

export const courseRelations = relations(courseTable, ({ one }) => ({
  author: one(userTable, {
    fields: [courseTable.authorId],
    references: [userTable.id],
  }),
}));

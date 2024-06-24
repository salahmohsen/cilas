import {
  integer,
  text,
  boolean,
  pgTable,
  serial,
  date,
  time,
  json,
  timestamp,
  varchar,
  pgEnum,
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
  days: json("days"),
  dateRange: json("date_range").notNull(),
  timeSlot: json("time_slot").notNull(),
  students: json("students"),
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

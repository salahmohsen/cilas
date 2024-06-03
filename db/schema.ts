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
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  bio: text("bio"),
  email: text("email"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const courseCategory = pgTable("course_category", {
  id: serial("id").primaryKey(),
  category: text("category"),
});

export const courses = pgTable("course", {
  id: serial("id").primaryKey(),
  enTitle: text("en_title").notNull(),
  arTitle: text("ar_title"),
  image: text("image_url"),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  enContent: text("en_content"),
  arContent: text("ar_content"),
  seasonCycle: text("season_cycle"),
  category: text("category").notNull(),
  attendance: text("attendance").notNull(),
  registrationStatus: boolean("registration_status").notNull(),
  price: integer("price"),
  startDate: date("start_date").notNull(),
  endDate: date("end_Date").notNull(),
  weekDuration: integer("week_duration"),
  days: json("days"),
  sessionStartTime: time("session_start_at").notNull(),
  sessionEndTime: time("session_end_at").notNull(),
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const draftCourses = pgTable("draft-course", {
  id: serial("id").primaryKey(),
  enTitle: text("en_title"),
  arTitle: text("ar_title"),
  image: text("image_url"),
  authorId: integer("author_id").references(() => users.id),
  enContent: text("en_content"),
  arContent: text("ar_content"),
  seasonCycle: text("season_cycle"),
  category: text("category"),
  attendance: text("attendance"),
  registrationStatus: boolean("registration_status"),
  price: integer("price"),
  startDate: date("start_date"),
  endDate: date("end_Date"),
  weekDuration: integer("week_duration"),
  days: json("days"),
  sessionStartTime: time("session_start_at"),
  sessionEndTime: time("session_end_at"),
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

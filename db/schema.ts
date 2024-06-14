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
} from "drizzle-orm/pg-core";

export const userTable = pgTable("users", {
  id: varchar("id", {
    length: 255,
  }).primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  bio: text("bio"),
  email: text("email"),
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  category: text("category").notNull(),
  registrationStatus: boolean("registration_status").notNull(),
  attendance: text("attendance").notNull(),
  price: integer("price"),
  days: json("days"),
  startDate: date("start_date").notNull(),
  endDate: date("end_Date").notNull(),
  sessionStartTime: time("session_start_at").notNull(),
  sessionEndTime: time("session_end_at").notNull(),
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

export const courses = pgTable("course", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorId: integer("author_id")
    .notNull()
    .references(() => users.id),
  courseType: text("course_type").notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  seasonName: text("season_name"),
  year: integer("course_year"),
  attendanceType: text("attendance_type").notNull(),
  registrationStatus: boolean("registration_status").notNull(),
  startDate: date("start_date").notNull(),
  sessionStartTime: time("session_start_time").notNull(),
  sessionEndTime: time("session_end_time").notNull(),
  days: json("days"),
  durationInWeeks: integer("duration_in_weeks"),
  courseFlowUrl: text("course_flow_url"),
  applyUrl: text("apply_url").notNull(),
  price: integer("price"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

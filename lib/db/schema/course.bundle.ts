import { relations } from "drizzle-orm";
import {
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import courseTable from "./course";

const bundleTable = pgTable("course_bundle", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).unique().notNull(),
  description: text("description"),
  year: integer("year").notNull(),
  cycle: varchar("cycle", { length: 50 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  attendance: varchar("attendance", { length: 50 }).notNull(),
  deadline: date("deadline", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const bundleRelations = relations(bundleTable, ({ many }) => ({
  courses: many(courseTable),
}));

export default bundleTable;

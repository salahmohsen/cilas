import { JSONContent } from "@tiptap/core";
import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  integer,
  json,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import courseFellowTable from "./course.fellows";
import courseToCategory from "./course.to.category";
import enrollmentTable from "./enrollment";

type TimeSlot = {
  from: Date;
  to: Date;
};

const timeSlot = customType<{ data: TimeSlot }>({
  dataType: () => "json",
  fromDriver: (value: unknown): TimeSlot => {
    // Runtime validation
    if (typeof value === "object" && value !== null) {
      const slot = value as { from?: string; to?: string };
      return {
        from: new Date(slot.from || Date.now()),
        to: new Date(slot.to || Date.now()),
      };
    }
    throw new Error("Invalid time slot format");
  },
  toDriver: (value: TimeSlot): unknown => ({
    from: value.from.toISOString(),
    to: value.to.toISOString(),
  }),
});

const days = json("days").$type<
  {
    label: string;
    value: string;
  }[]
>();

export const attendanceTypeEnum = pgEnum("attendance_type", [
  "online",
  "offline",
  "hybrid",
]);

const courseTable = pgTable("course", {
  id: serial("id").primaryKey(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  isDraft: boolean("is_draft").default(true),
  enTitle: varchar("en_title", { length: 255 }),
  enContent: json("en_content").$type<JSONContent>(),
  arTitle: varchar("ar_title", { length: 255 }),
  arContent: json("ar_content").$type<JSONContent>(),
  featuredImage: text("featured_image"),
  isRegistrationOpen: boolean("is_registration_open").notNull().default(false),
  attendance: attendanceTypeEnum("attendance").notNull(),
  suggestedPrice: json("suggestedPrice").notNull().$type<[number, number]>(),
  days: days,
  startDate: date("start_date", { mode: "date" }).notNull(),
  endDate: date("end_date", { mode: "date" }).notNull(),
  timeSlot: timeSlot("time_slot").notNull(),
  maxStudents: integer("max_students"),
  applyUrl: text("apply_url"),
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const courseRelations = relations(courseTable, ({ one, many }) => ({
  fellows: many(courseFellowTable),
  enrollments: many(enrollmentTable),
  category: one(courseToCategory, {
    fields: [courseTable.id],
    references: [courseToCategory.courseId],
  }),
}));

export default courseTable;

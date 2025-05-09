import { relations } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import enrollmentTable from "./enrollment";
import userTable from "./user";

export type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: {
    type: string;
    attrs?: Record<string, unknown>;
    [key: string]: unknown;
  }[];
  text?: string;
  [key: string]: unknown;
};

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

const courseTable = pgTable("course", {
  id: serial("id").primaryKey(),
  draftMode: boolean("draft_mode").default(true),
  enTitle: varchar("en_title", { length: 255 }),
  enContent: json("en_content").$type<JSONContent>(),
  arTitle: varchar("ar_title", { length: 255 }),
  arContent: json("ar_content").$type<JSONContent>(),
  featuredImage: text("featured_image"),
  fellowId: text("fellow_id")
    .notNull()
    .references(() => userTable.id),
  category: varchar("category", { length: 100 }).notNull(),
  isRegistrationOpen: boolean("is_registration_open").notNull().default(false),
  attendance: varchar("attendance", { length: 50 }).notNull(),
  suggestedPrice: json("suggestedPrice").notNull().$type<[number, number]>(),
  days: json("days").$type<
    {
      label: string;
      value: string;
      disable?: boolean;
    }[]
  >(),
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
  fellow: one(userTable, {
    fields: [courseTable.fellowId],
    references: [userTable.id],
  }),
  enrollments: many(enrollmentTable),
}));

export default courseTable;

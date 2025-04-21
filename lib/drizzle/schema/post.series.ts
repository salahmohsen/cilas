import { pgTable, serial, text, varchar } from "drizzle-orm/pg-core";

const seriesTable = pgTable("series", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
});

export default seriesTable;

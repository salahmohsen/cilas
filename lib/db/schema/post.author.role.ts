import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

const authorRulesTable = pgTable("blog_posts_rules", {
  id: serial("id").primaryKey(),
  arName: varchar("ar_name", { length: 255 }).unique(),
  enName: varchar("en_name", { length: 255 }).unique().notNull(),
  arDescription: varchar("description", { length: 255 }),
  enDescription: varchar("description", { length: 255 }),
});

export default authorRulesTable;

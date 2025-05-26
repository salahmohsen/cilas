import { timestamp, pgTable, varchar, serial } from 'drizzle-orm/pg-core';

export const postCategories = pgTable('post_categories', {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  arName: varchar('ar_name', { length: 100 }).unique().notNull(),
  enName: varchar('en_name', { length: 100 }).unique().notNull(),
  slug: varchar('slug', { length: 150 }).unique().notNull(),
  id: serial('id').primaryKey()
});

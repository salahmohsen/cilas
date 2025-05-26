import { pgTable, varchar, serial, text } from 'drizzle-orm/pg-core';

export const postSeries = pgTable('series', {
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  id: serial('id').primaryKey()
});

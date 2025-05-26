import { pgTable, varchar, serial } from 'drizzle-orm/pg-core';

export const authorRoles = pgTable('posts_authors_roles', {
  enName: varchar('en_name', { length: 255 }).unique().notNull(),
  arDescription: varchar('description', { length: 255 }),
  enDescription: varchar('description', { length: 255 }),
  arName: varchar('ar_name', { length: 255 }).unique(),
  id: serial('id').primaryKey()
});

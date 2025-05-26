import {
  primaryKey,
  boolean,
  integer,
  pgTable,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { authorRoles } from './post.author.role';
import { user } from './auth-schema';

export const authorToRoleTable = pgTable(
  'author_to_role',
  {
    roleId: integer('role_id')
      .notNull()
      .references(() => authorRoles.id, { onDelete: 'cascade' }),

    authorId: text('author_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),

    isMainAuthor: boolean('is_main_author').notNull().default(false)
  },
  (t) => [primaryKey({ columns: [t.authorId, t.roleId] })]
);

export const postAuthorRelations = relations(authorToRoleTable, ({ one }) => ({
  role: one(authorRoles, {
    fields: [authorToRoleTable.roleId],
    references: [authorRoles.id]
  }),
  author: one(user, {
    fields: [authorToRoleTable.authorId],
    references: [user.id]
  })
}));

import {
  timestamp,
  boolean,
  pgTable,
  varchar,
  serial,
  json,
  text
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

import { postsToCategories } from './post.to.category';
import { authors } from './post.authors';
import postsToTags from './post.to.tag';
import { JSONContent } from './course';

export const posts = pgTable('posts', {
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow(),
  publishedAt: timestamp('published_at', {
    withTimezone: true,
    mode: 'date'
  }).notNull(),
  arContent: json('ar_content').$type<JSONContent>().notNull(),
  enContent: json('en_content').$type<JSONContent>().notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  arTitle: varchar('ar_title', { length: 255 }).notNull(),
  enTitle: varchar('en_title', { length: 255 }).notNull(),
  isDraft: boolean('is_draft').notNull().default(true),
  featuredImage: text('featured_image'),
  id: serial('id').primaryKey(),
  excerpt: text('excerpt')
});

export const postsRelations = relations(posts, ({ many }) => ({
  categories: many(postsToCategories),
  tags: many(postsToTags),
  authors: many(authors)
}));

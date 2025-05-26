import { timestamp, pgTable, boolean, text } from 'drizzle-orm/pg-core';

export const user = pgTable('user', {
  emailVerified: boolean('email_verified').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  email: text('email').notNull().unique(),
  banExpires: timestamp('ban_expires'),
  banReason: text('ban_reason'),
  name: text('name').notNull(),
  id: text('id').primaryKey(),
  banned: boolean('banned'),
  image: text('image'),
  role: text('role')
});

export const session = pgTable('session', {
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  token: text('token').notNull().unique(),
  impersonatedBy: text('impersonated_by'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  id: text('id').primaryKey()
});

export const account = pgTable('account', {
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  providerId: text('provider_id').notNull(),
  accountId: text('account_id').notNull(),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  id: text('id').primaryKey(),
  password: text('password'),
  idToken: text('id_token'),
  scope: text('scope')
});

export const verification = pgTable('verification', {
  expiresAt: timestamp('expires_at').notNull(),
  identifier: text('identifier').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
  value: text('value').notNull(),
  id: text('id').primaryKey()
});

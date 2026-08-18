import { createInsertSchema } from 'drizzle-zod';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { z } from 'zod/v4';

const attachmentData = customType<{ data: Buffer; driverData: Buffer; notNull: true }>({
  dataType() {
    return 'bytea';
  },
});

export const usersTable = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessionsTable = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const storiesTable = pgTable(
  'stories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    color: text('color').notNull().default('#3F8F4F'),
    readAllBeforeAnswer: boolean('read_all_before_answer').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('stories_user_id_idx').on(table.userId)],
);

export const conversationsTable = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    storyId: uuid('story_id')
      .notNull()
      .references(() => storiesTable.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Nova conversa'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('conversations_user_id_idx').on(table.userId),
    index('conversations_story_id_idx').on(table.storyId),
  ],
);

export const attachmentsTable = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    key: text('key').notNull().unique(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    size: integer('size').notNull(),
    checksum: text('checksum').notNull(),
    data: attachmentData('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('attachments_user_id_idx').on(table.userId)],
);

export type MessageAttachment = {
  id?: string;
  name: string;
  type: string;
  size: number;
  key?: string;
  url?: string;
};

export const messagesTable = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversationsTable.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    attachments: jsonb('attachments').$type<MessageAttachment[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('messages_conversation_id_idx').on(table.conversationId)],
);

export const memoriesTable = pgTable(
  'memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => usersTable.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    source: text('source').notNull().default('conversation'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('memories_user_id_idx').on(table.userId)],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true, createdAt: true });
export const insertStorySchema = createInsertSchema(storiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable)
  .omit({ id: true, createdAt: true })
  .extend({ role: z.enum(['user', 'assistant', 'system']) });
export const insertMemorySchema = createInsertSchema(memoriesTable).omit({ id: true, createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type Session = typeof sessionsTable.$inferSelect;
export type Story = typeof storiesTable.$inferSelect;
export type Conversation = typeof conversationsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Attachment = typeof attachmentsTable.$inferSelect;
export type Memory = typeof memoriesTable.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertAttachment = typeof attachmentsTable.$inferInsert;
export type InsertMemory = z.infer<typeof insertMemorySchema>;

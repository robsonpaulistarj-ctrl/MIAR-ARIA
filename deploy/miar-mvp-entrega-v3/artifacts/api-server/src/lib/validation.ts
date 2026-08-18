import { z } from 'zod';
import { ApiError } from './current-user';

export const attachmentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  type: z.string().max(120),
  size: z.number().int().nonnegative().max(25 * 1024 * 1024),
  key: z.string().min(1).max(600).optional(),
  url: z.string().regex(/^\/api\/uploads\/[A-Za-z0-9_-]+$/).optional(),
});

export const createStorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).default(''),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#3F8F4F'),
  readAllBeforeAnswer: z.boolean().default(true),
});

export const createConversationSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().trim().min(1).max(180).default('Nova conversa'),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(20000),
  attachments: z.array(attachmentSchema).max(10).default([]),
  useAllHistory: z.boolean().default(false),
});

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, parsed.error.issues.map((issue) => issue.message).join('; '));
  }
  return parsed.data;
}

import { randomUUID } from 'node:crypto';
import { db, type Conversation, type Message, type MessageAttachment, type Story, type User } from '@workspace/db';

type Attachment = MessageAttachment;

type MemorySession = {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
};

const users = new Map<string, User>();
const usersByEmail = new Map<string, string>();
const sessions = new Map<string, MemorySession>();
const stories = new Map<string, Story>();
const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message>();

export const memoryStorageEnabled = !db && (process.env.NODE_ENV !== 'production' || process.env.ALLOW_EPHEMERAL_DB === 'true');

function now() {
  return new Date();
}

export function memoryGetOrCreateUser(email: string, displayName = email.split('@')[0] || 'Utilizador') {
  const normalizedEmail = email.trim().toLowerCase();
  const existingId = usersByEmail.get(normalizedEmail);
  if (existingId) return users.get(existingId)!;
  const user: User = {
    id: randomUUID(),
    email: normalizedEmail,
    displayName,
    createdAt: now(),
  };
  users.set(user.id, user);
  usersByEmail.set(user.email, user.id);
  return user;
}

export function memoryGetUserBySession(tokenHash: string) {
  const session = sessions.get(tokenHash);
  if (!session || session.expiresAt <= now()) {
    sessions.delete(tokenHash);
    return undefined;
  }
  return users.get(session.userId);
}

export function memoryCreateSession(userId: string, tokenHash: string, expiresAt: Date) {
  sessions.set(tokenHash, { userId, tokenHash, expiresAt });
}

export function memoryListStories(userId: string) {
  return [...stories.values()]
    .filter((story) => story.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function memoryGetStory(userId: string, storyId: string) {
  const story = stories.get(storyId);
  return story?.userId === userId ? story : undefined;
}

export function memoryCreateStory(userId: string, input: { name: string; description: string; color: string; readAllBeforeAnswer: boolean }) {
  const timestamp = now();
  const story: Story = { id: randomUUID(), userId, ...input, createdAt: timestamp, updatedAt: timestamp };
  stories.set(story.id, story);
  return story;
}

export function memoryDeleteStory(userId: string, storyId: string) {
  const story = memoryGetStory(userId, storyId);
  if (!story) return false;
  stories.delete(storyId);
  for (const conversation of conversations.values()) {
    if (conversation.storyId === storyId) {
      conversations.delete(conversation.id);
      for (const message of messages.values()) {
        if (message.conversationId === conversation.id) messages.delete(message.id);
      }
    }
  }
  return true;
}

export function memoryListConversations(userId: string, storyId?: string) {
  return [...conversations.values()]
    .filter((conversation) => conversation.userId === userId && (!storyId || conversation.storyId === storyId))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function memoryGetConversation(userId: string, conversationId: string) {
  const conversation = conversations.get(conversationId);
  return conversation?.userId === userId ? conversation : undefined;
}

export function memoryCreateConversation(userId: string, storyId: string, title: string) {
  const timestamp = now();
  const conversation: Conversation = {
    id: randomUUID(),
    userId,
    storyId,
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  conversations.set(conversation.id, conversation);
  return conversation;
}

export function memoryUpdateConversation(id: string, input: { title?: string; updatedAt?: Date }) {
  const conversation = conversations.get(id);
  if (!conversation) return undefined;
  const updated = { ...conversation, ...input };
  conversations.set(id, updated);
  return updated;
}

export function memoryListMessages(conversationId: string) {
  return [...messages.values()]
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function memoryCreateMessage(input: { conversationId: string; role: 'user' | 'assistant' | 'system'; content: string; attachments?: Attachment[] }) {
  const message: Message = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    attachments: input.attachments ?? [],
    createdAt: now(),
  };
  messages.set(message.id, message);
  const conversation = conversations.get(input.conversationId);
  if (conversation) conversations.set(conversation.id, { ...conversation, updatedAt: message.createdAt });
  return message;
}

import { Router, type IRouter } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  conversationsTable,
  messagesTable,
  requireDb,
  storiesTable,
} from '@workspace/db';
import {
  memoryCreateConversation,
  memoryCreateMessage,
  memoryGetConversation,
  memoryGetStory,
  memoryListConversations,
  memoryListMessages,
  memoryListStories,
  memoryUpdateConversation,
  memoryStorageEnabled,
} from '../lib/memory-store';
import { generateAssistantReply, type ChatImage, type ChatTurn } from '../lib/ai';
import { readAttachmentBuffer } from '../lib/attachment-storage';
import { rateLimit } from '../lib/rate-limit';
import { ApiError, getCurrentUser } from '../lib/current-user';
import { createConversationSchema, parseBody, sendMessageSchema } from '../lib/validation';

const router: IRouter = Router();

function buildTurns(history: Array<{ role: string; content: string }>, content: string): ChatTurn[] {
  return [
    ...history.map((message) => ({ role: message.role as ChatTurn['role'], content: message.content })),
    { role: 'user', content },
  ];
}

function buildStoryContext(stories: Array<{ id: string; name: string; description: string }>, currentStoryId: string) {
  return stories
    .filter((story) => story.id !== currentStoryId)
    .map((story) => `- ${story.name}: ${story.description}`)
    .join('\\n');
}

async function buildVisionImages(userId: string, attachments: Array<{ type: string; key?: string }>): Promise<ChatImage[]> {
  const maxVisionImageBytes = Number(process.env.AI_MAX_IMAGE_BYTES ?? 10 * 1024 * 1024);
  const images: ChatImage[] = [];
  for (const attachment of attachments) {
    if (!attachment.key) continue;
    const stored = await readAttachmentBuffer(userId, attachment.key);
    if (!stored.contentType.toLowerCase().startsWith('image/')) continue;
    if (stored.body.length > maxVisionImageBytes) continue;
    images.push({
      mediaType: stored.contentType,
      dataUrl: `data:${stored.contentType};base64,${stored.body.toString('base64')}`,
    });
  }
  return images;
}

router.get('/conversations', async (request, response) => {
  const user = await getCurrentUser(request);
  const storyId = typeof request.query.storyId === 'string' ? request.query.storyId : undefined;
  if (memoryStorageEnabled) {
    response.json(memoryListConversations(user.id, storyId));
    return;
  }

  const database = requireDb();
  const conditions = storyId
    ? and(eq(conversationsTable.userId, user.id), eq(conversationsTable.storyId, storyId))
    : eq(conversationsTable.userId, user.id);
  const conversations = await database
    .select()
    .from(conversationsTable)
    .where(conditions)
    .orderBy(desc(conversationsTable.updatedAt));
  response.json(conversations);
});

router.post('/conversations', async (request, response) => {
  const user = await getCurrentUser(request);
  const input = parseBody(createConversationSchema, request.body);

  if (memoryStorageEnabled) {
    const story = memoryGetStory(user.id, input.storyId);
    if (!story) throw new ApiError(404, 'Story not found.');
    const created = memoryCreateConversation(user.id, input.storyId, input.title);
    const greeting = memoryCreateMessage({
      conversationId: created.id,
      role: 'assistant',
      content: `Olá! Eu estou pronta para ajudar com a história “${story.name}”.`,
      attachments: [],
    });
    response.status(201).json({ ...created, messages: [greeting] });
    return;
  }

  const database = requireDb();
  const story = await database
    .select()
    .from(storiesTable)
    .where(and(eq(storiesTable.id, input.storyId), eq(storiesTable.userId, user.id)))
    .limit(1);
  if (!story[0]) throw new ApiError(404, 'Story not found.');
  const created = await database
    .insert(conversationsTable)
    .values({ ...input, userId: user.id })
    .returning();
  if (!created[0]) throw new ApiError(500, 'Could not create conversation.');
  const greeting = await database
    .insert(messagesTable)
    .values({
      conversationId: created[0].id,
      role: 'assistant',
      content: `Olá! Eu estou pronta para ajudar com a história “${story[0].name}”.`,
      attachments: [],
    })
    .returning();
  response.status(201).json({ ...created[0], messages: greeting });
});

router.get('/conversations/:conversationId', async (request, response) => {
  const user = await getCurrentUser(request);
  if (memoryStorageEnabled) {
    const conversation = memoryGetConversation(user.id, request.params.conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');
    response.json({ ...conversation, messages: memoryListMessages(conversation.id) });
    return;
  }

  const database = requireDb();
  const conversation = await database
    .select()
    .from(conversationsTable)
    .where(and(eq(conversationsTable.id, request.params.conversationId), eq(conversationsTable.userId, user.id)))
    .limit(1);
  if (!conversation[0]) throw new ApiError(404, 'Conversation not found.');
  const messages = await database
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversation[0].id))
    .orderBy(asc(messagesTable.createdAt));
  response.json({ ...conversation[0], messages });
});

router.post('/conversations/:conversationId/messages', rateLimit({ name: 'ai', windowMs: 60_000, max: 20 }), async (request, response) => {
  const user = await getCurrentUser(request);
  const conversationId = Array.isArray(request.params.conversationId) ? request.params.conversationId[0] : request.params.conversationId;
  const input = parseBody(sendMessageSchema, request.body);

  if (memoryStorageEnabled) {
    const conversation = memoryGetConversation(user.id, conversationId);
    if (!conversation) throw new ApiError(404, 'Conversation not found.');
    const story = memoryGetStory(user.id, conversation.storyId);
    if (!story) throw new ApiError(404, 'Story not found.');
    const history = memoryListMessages(conversation.id);
    const includeAllStories = input.useAllHistory || story.readAllBeforeAnswer;
    const storyContext = includeAllStories ? buildStoryContext(memoryListStories(user.id), story.id) : undefined;
    const visionImages = await buildVisionImages(user.id, input.attachments);
    const userMessage = memoryCreateMessage({
      conversationId: conversation.id,
      role: 'user',
      content: input.content,
      attachments: input.attachments,
    });
    const assistantContent = await generateAssistantReply({
      storyName: story.name,
      storyDescription: story.description,
      storyContext,
      turns: buildTurns(history, input.content),
      images: visionImages,
    });
    const assistantMessage = memoryCreateMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
      attachments: [],
    });
    const nextTitle = conversation.title === 'Nova conversa'
      ? input.content.replace(/\s+/g, ' ').trim().slice(0, 58)
      : conversation.title;
    const updatedConversation = memoryUpdateConversation(conversation.id, {
      title: nextTitle || 'Nova conversa',
      updatedAt: new Date(),
    });
    response.status(201).json({
      conversation: updatedConversation ?? conversation,
      userMessage,
      assistantMessage,
    });
    return;
  }

  const database = requireDb();
  const conversation = await database
    .select({ conversation: conversationsTable, story: storiesTable })
    .from(conversationsTable)
    .innerJoin(storiesTable, eq(storiesTable.id, conversationsTable.storyId))
    .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.userId, user.id)))
    .limit(1);
  if (!conversation[0]) throw new ApiError(404, 'Conversation not found.');
  const current = conversation[0];
  const history = await database
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, current.conversation.id))
    .orderBy(asc(messagesTable.createdAt));
  const includeAllStories = input.useAllHistory || current.story.readAllBeforeAnswer;
  const allStories = includeAllStories
    ? await database
      .select({ id: storiesTable.id, name: storiesTable.name, description: storiesTable.description })
      .from(storiesTable)
      .where(eq(storiesTable.userId, user.id))
      .orderBy(asc(storiesTable.createdAt))
    : [];
  const storyContext = includeAllStories ? buildStoryContext(allStories, current.story.id) : undefined;
  const visionImages = await buildVisionImages(user.id, input.attachments);
  const userMessage = await database
    .insert(messagesTable)
    .values({
      conversationId: current.conversation.id,
      role: 'user',
      content: input.content,
      attachments: input.attachments,
    })
    .returning();
  if (!userMessage[0]) throw new ApiError(500, 'Could not save user message.');
  const assistantContent = await generateAssistantReply({
    storyName: current.story.name,
    storyDescription: current.story.description,
    storyContext,
    turns: buildTurns(history, input.content),
    images: visionImages,
  });
  const assistantMessage = await database
    .insert(messagesTable)
    .values({ conversationId: current.conversation.id, role: 'assistant', content: assistantContent, attachments: [] })
    .returning();
  if (!assistantMessage[0]) throw new ApiError(500, 'Could not save assistant message.');
  const nextTitle = current.conversation.title === 'Nova conversa'
    ? input.content.replace(/\s+/g, ' ').trim().slice(0, 58)
    : current.conversation.title;
  const updatedConversation = await database
    .update(conversationsTable)
    .set({ title: nextTitle || 'Nova conversa', updatedAt: new Date() })
    .where(eq(conversationsTable.id, current.conversation.id))
    .returning();
  response.status(201).json({
    conversation: updatedConversation[0] ?? current.conversation,
    userMessage: userMessage[0],
    assistantMessage: assistantMessage[0],
  });
});

export default router;

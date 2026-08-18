import { Router, type IRouter } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { requireDb, storiesTable } from '@workspace/db';
import { memoryCreateStory, memoryDeleteStory, memoryListStories, memoryStorageEnabled } from '../lib/memory-store';
import { ApiError, getCurrentUser } from '../lib/current-user';
import { createStorySchema, parseBody } from '../lib/validation';

const router: IRouter = Router();

router.get('/stories', async (request, response) => {
  const user = await getCurrentUser(request);
  if (memoryStorageEnabled) {
    response.json(memoryListStories(user.id));
    return;
  }
  const database = requireDb();
  const stories = await database
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.userId, user.id))
    .orderBy(desc(storiesTable.createdAt));
  response.json(stories);
});

router.post('/stories', async (request, response) => {
  const user = await getCurrentUser(request);
  const input = parseBody(createStorySchema, request.body);
  if (memoryStorageEnabled) {
    response.status(201).json(memoryCreateStory(user.id, input));
    return;
  }
  const database = requireDb();
  const created = await database
    .insert(storiesTable)
    .values({ ...input, userId: user.id })
    .returning();
  if (!created[0]) throw new ApiError(500, 'Could not create story.');
  response.status(201).json(created[0]);
});

router.delete('/stories/:storyId', async (request, response) => {
  const user = await getCurrentUser(request);
  const storyId = request.params.storyId;
  if (memoryStorageEnabled) {
    if (!memoryDeleteStory(user.id, storyId)) throw new ApiError(404, 'Story not found.');
    response.status(204).send();
    return;
  }
  const database = requireDb();
  const deleted = await database
    .delete(storiesTable)
    .where(and(eq(storiesTable.id, storyId), eq(storiesTable.userId, user.id)))
    .returning({ id: storiesTable.id });
  if (!deleted[0]) throw new ApiError(404, 'Story not found.');
  response.status(204).send();
});

export default router;

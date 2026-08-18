import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, type IRouter } from 'express';
import { eq } from 'drizzle-orm';
import { db, sessionsTable, usersTable } from '@workspace/db';
import { ApiError, getCurrentUser } from '../lib/current-user';
import { memoryCreateSession, memoryGetOrCreateUser, memoryStorageEnabled } from '../lib/memory-store';
import { parseBody } from '../lib/validation';
import { z } from 'zod';

const router: IRouter = Router();
const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  token: z.string().min(1).max(500),
});
const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;

function tokenMatches(expectedToken: string, suppliedToken: string) {
  const expected = createHash('sha256').update(expectedToken).digest();
  const supplied = createHash('sha256').update(suppliedToken).digest();
  return timingSafeEqual(expected, supplied);
}

router.get('/auth/me', async (request, response) => {
  const user = await getCurrentUser(request);
  response.json({ user });
});

router.post('/auth/login', async (request, response) => {
  if (!db && !memoryStorageEnabled) throw new ApiError(503, 'DATABASE_URL is required for authentication.');
  const configuredToken = process.env.MIAR_ACCESS_TOKEN?.trim();
  if (!configuredToken) throw new ApiError(500, 'MIAR_ACCESS_TOKEN is not configured.');
  const input = parseBody(loginSchema, request.body);
  if (!tokenMatches(configuredToken, input.token)) throw new ApiError(401, 'Invalid access token.');

  const email = input.email.toLowerCase();
  const user = memoryStorageEnabled
    ? memoryGetOrCreateUser(email)
    : (await db!.select().from(usersTable).where(eq(usersTable.email, email)).limit(1))[0]
      ?? (await db!
        .insert(usersTable)
        .values({ email, displayName: input.email.split('@')[0] ?? 'Utilizador' })
        .returning())[0];
  if (!user) throw new ApiError(500, 'Could not create user.');

  const sessionToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  if (memoryStorageEnabled) {
    memoryCreateSession(user.id, tokenHash, expiresAt);
  } else {
    await db!.insert(sessionsTable).values({ userId: user.id, tokenHash, expiresAt });
  }

  response.cookie('miar_session', sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionDurationMs,
    path: '/',
  });
  response.json({ user });
});

router.post('/auth/logout', (request, response) => {
  response.clearCookie('miar_session', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  response.status(204).send();
});

export default router;

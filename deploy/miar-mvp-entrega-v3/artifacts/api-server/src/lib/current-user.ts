import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { db, sessionsTable, usersTable, type User } from '@workspace/db';
import { memoryGetOrCreateUser, memoryGetUserBySession, memoryStorageEnabled } from './memory-store';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function getOrCreateUser(email: string): Promise<User> {
  if (memoryStorageEnabled) return memoryGetOrCreateUser(email);

  const existing = await db!.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing[0]) return existing[0];

  const created = await db!
    .insert(usersTable)
    .values({
      email,
      displayName: email.split('@')[0] || 'Utilizador',
    })
    .returning();

  if (!created[0]) throw new ApiError(500, 'Could not create the public user.');
  return created[0];
}

export async function getCurrentUser(request: Request): Promise<User> {
  if (!db && !memoryStorageEnabled) {
    throw new ApiError(503, 'DATABASE_URL is required for data operations.');
  }

  const publicAccess = process.env.MIAR_PUBLIC_ACCESS === 'true'
    || (process.env.NODE_ENV === 'production' && process.env.MIAR_PUBLIC_ACCESS !== 'false');
  if (publicAccess) {
    const email = process.env.PUBLIC_USER_EMAIL?.trim().toLowerCase() || 'public@miar.local';
    return getOrCreateUser(email);
  }

  const sessionToken = request.cookies?.miar_session;
  if (sessionToken) {
    const tokenHash = createHash('sha256').update(sessionToken).digest('hex');
    if (memoryStorageEnabled) {
      const memoryUser = memoryGetUserBySession(tokenHash);
      if (memoryUser) return memoryUser;
    } else {
      const activeSession = await db!
        .select({ user: usersTable })
        .from(sessionsTable)
        .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
        .where(and(eq(sessionsTable.tokenHash, tokenHash), gt(sessionsTable.expiresAt, new Date())))
        .limit(1);
      if (activeSession[0]?.user) return activeSession[0].user;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new ApiError(401, 'Authentication required.');
  }

  const email =
    request.header('x-miar-user')?.trim().toLowerCase() ||
    process.env.DEV_USER_EMAIL?.trim().toLowerCase() ||
    'dev@miar.local';

  return getOrCreateUser(email);
}

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import {
  aiProviderKeysTable,
  aiSettingsTable,
  db,
  requireDb,
} from '@workspace/db';
import { ApiError } from './current-user';

export const chatProviderNames = ['gemini', 'groq', 'mistral', 'openrouter', 'openai'] as const;
export const providerNames = [...chatProviderNames, 'mem0'] as const;
export type ProviderName = typeof providerNames[number];

export const providerDefaults: Record<ProviderName, { label: string; baseUrl: string; model: string }> = {
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
  },
  groq: {
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
  },
  mistral: {
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
  },
  openrouter: {
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  mem0: {
    label: 'Mem0 (memória)',
    baseUrl: 'https://api.mem0.ai',
    model: 'memory',
  },
};

export type PublicProviderKey = {
  id: string;
  provider: ProviderName;
  label: string;
  keyLast4: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  lastUsedAt: string | null;
  failureCount: number;
};

export type ProviderSettings = {
  activeProvider: ProviderName;
  activeModel: string;
  keys: PublicProviderKey[];
};

function secretKey() {
  const raw = process.env.MIAR_SECRETS_KEY?.trim();
  if (!raw) throw new ApiError(503, 'Configuração segura de APIs indisponível: MIAR_SECRETS_KEY não está definida.');
  return createHash('sha256').update(raw).digest();
}

export function encryptProviderKey(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptProviderKey(value: string) {
  const [version, ivText, tagText, encryptedText] = value.split(':');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) throw new ApiError(500, 'Chave de API armazenada em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
}

function normalizeProvider(value: string): ProviderName {
  if (!providerNames.includes(value as ProviderName)) throw new ApiError(400, 'Fornecedor de IA inválido.');
  return value as ProviderName;
}

function publicKey(row: typeof aiProviderKeysTable.$inferSelect): PublicProviderKey {
  return {
    id: row.id,
    provider: normalizeProvider(row.provider),
    label: row.label,
    keyLast4: row.keyLast4,
    baseUrl: row.baseUrl,
    model: row.model,
    enabled: row.enabled,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    failureCount: row.failureCount,
  };
}

export async function getProviderSettings(userId: string): Promise<ProviderSettings> {
  const database = requireDb();
  const [settings, keys] = await Promise.all([
    database.select().from(aiSettingsTable).where(eq(aiSettingsTable.userId, userId)).limit(1),
    database.select().from(aiProviderKeysTable).where(eq(aiProviderKeysTable.userId, userId)).orderBy(asc(aiProviderKeysTable.createdAt)),
  ]);
  const activeProvider = normalizeProvider(settings[0]?.activeProvider ?? process.env.AI_PROVIDER ?? 'gemini');
  return {
    activeProvider,
    activeModel: settings[0]?.activeModel ?? process.env.OPENAI_MODEL ?? providerDefaults[activeProvider].model,
    keys: keys.map(publicKey),
  };
}

export async function addProviderKey(userId: string, input: {
  provider: string;
  label?: string;
  key: string;
  baseUrl?: string;
  model?: string;
}) {
  const provider = normalizeProvider(input.provider);
  const key = input.key.trim();
  if (key.length < 10 || key.length > 800) throw new ApiError(400, 'A chave da API parece inválida.');
  const defaults = providerDefaults[provider];
  const database = requireDb();
  const created = await database.insert(aiProviderKeysTable).values({
    userId,
    provider,
    label: input.label?.trim() || `${defaults.label} ${provider}`,
    encryptedKey: encryptProviderKey(key),
    keyLast4: key.slice(-4),
    baseUrl: (input.baseUrl?.trim() || defaults.baseUrl).replace(/\/$/, ''),
    model: input.model?.trim() || defaults.model,
    enabled: true,
  }).returning();
  if (!created[0]) throw new ApiError(500, 'Não foi possível guardar a chave.');
  return publicKey(created[0]);
}

export async function updateProviderKey(userId: string, id: string, input: {
  label?: string;
  key?: string;
  baseUrl?: string;
  model?: string;
  enabled?: boolean;
}) {
  const database = requireDb();
  const existing = await database.select().from(aiProviderKeysTable).where(and(eq(aiProviderKeysTable.id, id), eq(aiProviderKeysTable.userId, userId))).limit(1);
  if (!existing[0]) throw new ApiError(404, 'Chave não encontrada.');
  const nextKey = input.key?.trim();
  if (nextKey !== undefined && (nextKey.length < 10 || nextKey.length > 800)) throw new ApiError(400, 'A chave da API parece inválida.');
  const updated = await database.update(aiProviderKeysTable).set({
    label: input.label?.trim() || existing[0].label,
    ...(nextKey ? { encryptedKey: encryptProviderKey(nextKey), keyLast4: nextKey.slice(-4) } : {}),
    ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl.trim().replace(/\/$/, '') } : {}),
    ...(input.model !== undefined ? { model: input.model.trim() } : {}),
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    updatedAt: new Date(),
  }).where(eq(aiProviderKeysTable.id, id)).returning();
  if (!updated[0]) throw new ApiError(500, 'Não foi possível actualizar a chave.');
  return publicKey(updated[0]);
}

export async function deleteProviderKey(userId: string, id: string) {
  const database = requireDb();
  const deleted = await database.delete(aiProviderKeysTable).where(and(eq(aiProviderKeysTable.id, id), eq(aiProviderKeysTable.userId, userId))).returning({ id: aiProviderKeysTable.id });
  if (!deleted[0]) throw new ApiError(404, 'Chave não encontrada.');
}

export async function setActiveProvider(userId: string, input: { provider: string; model?: string }) {
  const provider = normalizeProvider(input.provider);
  const model = input.model?.trim() || providerDefaults[provider].model;
  const database = requireDb();
  const updated = await database.insert(aiSettingsTable).values({ userId, activeProvider: provider, activeModel: model }).onConflictDoUpdate({
    target: aiSettingsTable.userId,
    set: { activeProvider: provider, activeModel: model, updatedAt: new Date() },
  }).returning();
  return { activeProvider: updated[0]?.activeProvider ?? provider, activeModel: updated[0]?.activeModel ?? model };
}

export async function getActiveProviderCredentials(userId: string) {
  const settings = await getProviderSettings(userId);
  const database = requireDb();
  const candidates = await database.select().from(aiProviderKeysTable).where(and(eq(aiProviderKeysTable.userId, userId), eq(aiProviderKeysTable.provider, settings.activeProvider), eq(aiProviderKeysTable.enabled, true))).orderBy(asc(aiProviderKeysTable.lastUsedAt), asc(aiProviderKeysTable.createdAt));
  return { settings, candidates: candidates.map((row) => ({ ...row, secret: decryptProviderKey(row.encryptedKey) })) };
}

export async function markProviderKeyUsed(id: string, failure = false) {
  if (!db) return;
  await db.update(aiProviderKeysTable).set({
    lastUsedAt: new Date(),
    failureCount: failure ? sql`${aiProviderKeysTable.failureCount} + 1` : 0,
    updatedAt: new Date(),
  }).where(eq(aiProviderKeysTable.id, id));
}

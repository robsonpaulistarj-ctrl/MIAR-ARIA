import { Router, type IRouter } from 'express';
import { z } from 'zod';
import { ApiError, getCurrentUser } from '../lib/current-user';
import {
  addProviderKey,
  deleteProviderKey,
  getProviderSettings,
  providerNames,
  setActiveProvider,
  updateProviderKey,
} from '../lib/ai-provider-settings';

const router: IRouter = Router();
const settingsAdminToken = () => process.env.MIAR_SETTINGS_TOKEN?.trim();

function requireSettingsAccess(request: Parameters<IRouter['get']>[1] extends never ? never : any) {
  const expected = settingsAdminToken();
  if (!expected) throw new ApiError(503, 'Configuração das APIs indisponível: MIAR_SETTINGS_TOKEN não está definida.');
  const received = typeof request.header === 'function' ? request.header('x-miar-settings-token') : undefined;
  if (!received || received !== expected) throw new ApiError(403, 'Token de configurações inválido.');
}

const providerSchema = z.enum(providerNames);
const createKeySchema = z.object({
  provider: providerSchema,
  label: z.string().trim().max(120).optional(),
  key: z.string().trim().min(10).max(800),
  baseUrl: z.string().url().optional(),
  model: z.string().trim().max(180).optional(),
});
const updateKeySchema = z.object({
  label: z.string().trim().max(120).optional(),
  key: z.string().trim().min(10).max(800).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().trim().max(180).optional(),
  enabled: z.boolean().optional(),
});
const selectProviderSchema = z.object({ provider: providerSchema, model: z.string().trim().max(180).optional() });

router.get('/settings/ai', async (request, response) => {
  const user = await getCurrentUser(request);
  requireSettingsAccess(request);
  response.json(await getProviderSettings(user.id));
});

router.post('/settings/ai/keys', async (request, response) => {
  const user = await getCurrentUser(request);
  requireSettingsAccess(request);
  const input = createKeySchema.safeParse(request.body);
  if (!input.success) throw new ApiError(400, input.error.issues.map((issue) => issue.message).join('; '));
  response.status(201).json(await addProviderKey(user.id, input.data));
});

router.patch('/settings/ai/keys/:keyId', async (request, response) => {
  const user = await getCurrentUser(request);
  requireSettingsAccess(request);
  const input = updateKeySchema.safeParse(request.body);
  if (!input.success) throw new ApiError(400, input.error.issues.map((issue) => issue.message).join('; '));
  response.json(await updateProviderKey(user.id, request.params.keyId, input.data));
});

router.delete('/settings/ai/keys/:keyId', async (request, response) => {
  const user = await getCurrentUser(request);
  requireSettingsAccess(request);
  await deleteProviderKey(user.id, request.params.keyId);
  response.status(204).send();
});

router.post('/settings/ai/select', async (request, response) => {
  const user = await getCurrentUser(request);
  requireSettingsAccess(request);
  const input = selectProviderSchema.safeParse(request.body);
  if (!input.success) throw new ApiError(400, input.error.issues.map((issue) => issue.message).join('; '));
  response.json(await setActiveProvider(user.id, input.data));
});

export default router;

import { ApiError } from './current-user';
import {
  chatProviderNames,
  getActiveProviderCredentials,
  markProviderKeyUsed,
  providerDefaults,
  type ProviderName,
} from './ai-provider-settings';

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type ChatTurn = {
  role: 'user' | 'assistant' | 'system';
  content: string | ChatContentPart[];
};

export type ChatImage = {
  dataUrl: string;
  mediaType: string;
};

const demoReply = (message: string, storyName: string) =>
  `[Modo demonstração] Recebi a sua mensagem sobre “${storyName}”.\n\n` +
  'Para activar uma resposta real, adicione uma API em Configurações → APIs e modelos.\n\n' +
  'Mensagem recebida: ' + message;

function latestText(turns: ChatTurn[]) {
  const latestUserTurn = [...turns].reverse().find((turn) => turn.role === 'user');
  const text = typeof latestUserTurn?.content === 'string'
    ? latestUserTurn.content
    : latestUserTurn?.content?.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map((part) => part.text).join(' ')
      ?? '';
  return { latestUserTurn, text };
}

function resolveEnvironmentProvider(): ProviderName {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
  return configured && chatProviderNames.includes(configured as (typeof chatProviderNames)[number])
    ? configured as ProviderName
    : 'gemini';
}

function environmentCandidates(provider: ProviderName) {
  if (!chatProviderNames.includes(provider as (typeof chatProviderNames)[number])) return [];
  const prefix = `${provider.toUpperCase()}_API_KEY`;
  const names = Object.keys(process.env)
    .filter((name) => name === prefix || new RegExp(`^${prefix}_[0-9]+$`).test(name))
    .sort((left, right) => {
      if (left === prefix) return -1;
      if (right === prefix) return 1;
      return Number(left.slice(prefix.length + 1)) - Number(right.slice(prefix.length + 1));
    });
  const defaults = providerDefaults[provider];
  return names.flatMap((name) => {
    const secret = process.env[name]?.trim();
    if (!secret) return [];
    return [{
      id: `env:${name}`,
      provider,
      secret,
      baseUrl: (process.env[`${prefix}_BASE_URL`] ?? defaults.baseUrl).replace(/\/$/, ''),
      model: process.env[`${prefix}_MODEL`] ?? process.env.AI_MODEL ?? defaults.model,
    }];
  });
}

async function requestProvider({
  baseUrl,
  model,
  apiKey,
  messages,
}: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: ChatTurn[];
}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.7 }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(502, `AI provider failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) throw new ApiError(502, 'AI provider returned an empty response.');
  return content;
}

export async function generateAssistantReply({
  userId,
  storyName,
  storyDescription,
  storyContext,
  turns,
  images = [],
}: {
  userId?: string;
  storyName: string;
  storyDescription: string;
  storyContext?: string;
  turns: ChatTurn[];
  images?: ChatImage[];
}): Promise<string> {
  const { latestUserTurn, text: latestUserMessage } = latestText(turns);
  const turnsWithImages = images.length && latestUserTurn
    ? turns.map((turn) => turn === latestUserTurn
      ? {
          ...turn,
          content: [
            { type: 'text' as const, text: latestUserMessage },
            ...images.map((image) => ({ type: 'image_url' as const, image_url: { url: image.dataUrl } })),
          ],
        }
      : turn)
    : turns;
  const systemPrompt = [
    'Você é a MIAR, uma assistente pessoal em português do Brasil.',
    'Seja acolhedora, objetiva e não invente informações sobre a pessoa.',
    `Nome da história: ${storyName}`,
    storyDescription ? `Descrição da história: ${storyDescription}` : '',
    storyContext ? `Contexto adicional de todas as histórias:\n${storyContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const messages: ChatTurn[] = [{ role: 'system', content: systemPrompt }, ...turnsWithImages];

  let managed: Awaited<ReturnType<typeof getActiveProviderCredentials>> | null = null;
  if (userId) {
    try {
      managed = await getActiveProviderCredentials(userId);
    } catch {
      // O modo de desenvolvimento pode não ter a base de dados de configurações. Nesse caso,
      // mantemos o fallback por variáveis de ambiente, sem expor o erro ao utilizador final.
      managed = null;
    }
  }

  const managedCandidates = managed?.candidates ?? [];
  const activeProvider = managed?.settings.activeProvider ?? resolveEnvironmentProvider();
  const environmentKeys = environmentCandidates(activeProvider);
  const candidates = managedCandidates.length ? managedCandidates : environmentKeys;
  const liveMode = process.env.AI_MODE !== 'demo';
  if (liveMode && candidates.length) {
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const content = await requestProvider({
          baseUrl: candidate.baseUrl,
          model: candidate.model || managed?.settings.activeModel || providerDefaults[activeProvider].model,
          apiKey: candidate.secret,
          messages,
        });
        if (candidate.id.startsWith('env:')) return content;
        await markProviderKeyUsed(candidate.id, false);
        return content;
      } catch (error) {
        lastError = error;
        if (!candidate.id.startsWith('env:')) await markProviderKeyUsed(candidate.id, true).catch(() => undefined);
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new ApiError(502, 'Nenhuma chave activa conseguiu responder à IA.');
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || process.env.AI_MODE === 'demo') {
    return demoReply(latestUserMessage, storyName);
  }

  return requestProvider({
    baseUrl: process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
    apiKey,
    messages,
  });
}

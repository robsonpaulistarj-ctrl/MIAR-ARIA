import { ApiError } from './current-user';

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
  `Para ativar a resposta da IA, configure OPENAI_API_KEY no servidor. ` +
  `Enquanto isso, este modo confirma que o envio e o armazenamento da conversa estão funcionando.\n\n` +
  `Mensagem recebida: ${message}`;

export async function generateAssistantReply({
  storyName,
  storyDescription,
  storyContext,
  turns,
  images = [],
}: {
  storyName: string;
  storyDescription: string;
  storyContext?: string;
  turns: ChatTurn[];
  images?: ChatImage[];
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const latestUserTurn = [...turns].reverse().find((turn) => turn.role === 'user');
  const latestUserMessage = typeof latestUserTurn?.content === 'string'
    ? latestUserTurn.content
    : latestUserTurn?.content?.filter((part): part is { type: 'text'; text: string } => part.type === 'text').map((part) => part.text).join(' ')
      ?? '';

  if (!apiKey || process.env.AI_MODE === 'demo') {
    return demoReply(latestUserMessage, storyName);
  }

  const baseUrl = (process.env.OPENAI_API_BASE ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const systemPrompt = [
    'Você é a MIAR, uma assistente pessoal em português do Brasil.',
    'Seja acolhedora, objetiva e não invente informações sobre a pessoa.',
    `Nome da história: ${storyName}`,
    storyDescription ? `Descrição da história: ${storyDescription}` : '',
    storyContext ? `Contexto adicional de todas as histórias:\n${storyContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');

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

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...turnsWithImages],
      temperature: 0.7,
    }),
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

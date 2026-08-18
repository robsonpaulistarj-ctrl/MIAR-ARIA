import type { Response } from 'express';

type ConversationUpdate = {
  conversationId: string;
  updatedAt: string;
};

type Listener = {
  userId: string;
  response: Response;
  heartbeat: ReturnType<typeof setInterval>;
};

const listenersByConversation = new Map<string, Set<Listener>>();

export function registerConversationListener(userId: string, conversationId: string, response: Response) {
  response.status(200);
  response.setHeader('Content-Type', 'text/event-stream');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.setHeader('X-Accel-Buffering', 'no');
  response.flushHeaders?.();
  response.write('event: ready\ndata: {"status":"connected"}\n\n');

  const listener: Listener = {
    userId,
    response,
    heartbeat: setInterval(() => {
      response.write(': heartbeat\n\n');
    }, 25_000),
  };
  const listeners = listenersByConversation.get(conversationId) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByConversation.set(conversationId, listeners);

  return () => {
    clearInterval(listener.heartbeat);
    listeners.delete(listener);
    if (!listeners.size) listenersByConversation.delete(conversationId);
  };
}

export function publishConversationUpdate(userId: string, update: ConversationUpdate) {
  const listeners = listenersByConversation.get(update.conversationId);
  if (!listeners) return;
  const payload = `event: conversation.updated\ndata: ${JSON.stringify(update)}\n\n`;
  for (const listener of listeners) {
    if (listener.userId !== userId) continue;
    try {
      listener.response.write(payload);
    } catch {
      // The request close handler removes disconnected listeners.
    }
  }
}

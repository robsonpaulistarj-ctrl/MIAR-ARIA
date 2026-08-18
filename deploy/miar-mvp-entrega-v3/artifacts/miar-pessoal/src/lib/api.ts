export type RemoteStory = {
  id: string;
  name: string;
  description: string;
  color: string;
  readAllBeforeAnswer: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type RemoteAttachment = {
  id?: string;
  name: string;
  type: string;
  size: number;
  key?: string;
  url?: string;
};

export type RemoteMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  attachments: RemoteAttachment[];
};

export type RemoteConversation = {
  id: string;
  storyId: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messages?: RemoteMessage[];
};

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
const devUserEmail = import.meta.env.VITE_DEV_USER_EMAIL ?? 'dev@miar.local';
const authRequired = import.meta.env.VITE_AUTH_REQUIRED === 'true';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData)) headers.set('content-type', 'application/json');
  if (!authRequired) headers.set('x-miar-user', devUserEmail);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `API request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function login(input: { email: string; token: string }) {
  return request<{ user: { id: string; email: string; displayName: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getCurrentUser() {
  return request<{ user: { id: string; email: string; displayName: string } }>('/auth/me');
}

export function logout() {
  return request<void>('/auth/logout', { method: 'POST' });
}

export function listRemoteStories() {
  return request<RemoteStory[]>('/stories');
}

export function createRemoteStory(input: {
  name: string;
  description: string;
  color: string;
  readAllBeforeAnswer: boolean;
}) {
  return request<RemoteStory>('/stories', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listRemoteConversations(storyId?: string) {
  const query = storyId ? `?storyId=${encodeURIComponent(storyId)}` : '';
  return request<RemoteConversation[]>(`/conversations${query}`);
}

export function createRemoteConversation(input: { storyId: string; title: string }) {
  return request<RemoteConversation>('/conversations', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getRemoteConversation(id: string) {
  return request<RemoteConversation>(`/conversations/${id}`);
}

export function uploadRemoteAttachment(file: File) {
  const body = new FormData();
  body.append('file', file);
  return request<RemoteAttachment>('/uploads', {
    method: 'POST',
    body,
  });
}

export function sendRemoteMessage(id: string, input: {
  content: string;
  attachments: RemoteAttachment[];
  useAllHistory: boolean;
}) {
  return request<{
    conversation: RemoteConversation;
    userMessage: RemoteMessage;
    assistantMessage: RemoteMessage;
  }>(`/conversations/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

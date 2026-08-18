import { spawn } from 'node:child_process';

const port = Number(process.env.SMOKE_PORT ?? 18080);
const server = spawn('pnpm', ['--filter', './artifacts/api-server', 'dev'], {
  cwd: new URL('..', import.meta.url),
  detached: true,
  env: {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'development',
    AI_MODE: 'demo',
    MIAR_ACCESS_TOKEN: 'smoke-token',
    DATABASE_URL: '',
  },
  stdio: 'ignore',
});

const baseUrl = `http://127.0.0.1:${port}`;
const deadline = Date.now() + 20_000;

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = response.status === 204 ? undefined : await response.json();
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  let health;
  while (Date.now() < deadline) {
    try {
      health = await fetch(`${baseUrl}/api/healthz`);
      if (health.ok) break;
    } catch {
      // The server may still be compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(health?.ok, 'API did not become ready within 20 seconds.');
  assert((await health.json()).status === 'ok', 'Unexpected health response.');

  const invalidLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@miar.local', token: 'wrong-token' }),
  });
  assert(invalidLogin.response.status === 401, `Invalid token was accepted: ${invalidLogin.response.status}.`);

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'smoke@miar.local', token: 'smoke-token' }),
  });
  assert(login.response.status === 200, `Login failed with ${login.response.status}.`);
  const cookieHeader = login.response.headers.get('set-cookie');
  assert(cookieHeader, 'Login did not set a session cookie.');
  const cookie = cookieHeader.split(';', 1)[0];

  const me = await request('/api/auth/me', { headers: { Cookie: cookie } });
  assert(me.response.status === 200 && me.body.user.email === 'smoke@miar.local', `Session lookup failed: status=${me.response.status} body=${JSON.stringify(me.body)} cookie=${cookie}`);

  const stories = await request('/api/stories', { headers: { cookie } });
  assert(stories.response.status === 200 && Array.isArray(stories.body), 'Story listing failed.');
  const invalidStory = await request('/api/stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: '', description: 'invalid' }),
  });
  assert(invalidStory.response.status === 400, `Invalid story payload was accepted: ${invalidStory.response.status}.`);

  const story = await request('/api/stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Smoke Story', description: 'Flow validation', color: '#3F8F4F', readAllBeforeAnswer: true }),
  });
  assert(story.response.status === 201 && story.body.id, 'Story creation failed.');

  const contextStory = await request('/api/stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ name: 'Contexto adicional', description: 'Informação complementar para validar o contexto total.', color: '#4C7DFF', readAllBeforeAnswer: false }),
  });
  assert(contextStory.response.status === 201 && contextStory.body.id, 'Context story creation failed.');

  const conversation = await request('/api/conversations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ storyId: story.body.id, title: 'Nova conversa' }),
  });
  assert(conversation.response.status === 201 && conversation.body.messages?.length === 1, 'Conversation creation failed.');

  const uploadBody = new FormData();
  uploadBody.append('file', new Blob(['conteúdo de teste do anexo'], { type: 'text/plain' }), 'briefing.txt');
  const upload = await request('/api/uploads', {
    method: 'POST',
    headers: { Cookie: cookie },
    body: uploadBody,
  });
  assert(upload.response.status === 201 && upload.body?.url, `Attachment upload failed: ${upload.response.status} ${JSON.stringify(upload.body)}.`);
  const downloaded = await fetch(`${baseUrl}${upload.body.url}`, { headers: { Cookie: cookie } });
  assert(downloaded.status === 200 && (await downloaded.text()) === 'conteúdo de teste do anexo', 'Attachment download failed.');

  const message = await request(`/api/conversations/${conversation.body.id}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      content: 'Como devo começar?',
      attachments: [upload.body],
      useAllHistory: true,
    }),
  });
  assert(message.response.status === 201 && message.body.assistantMessage?.content, 'Message flow failed.');
  assert(message.body.userMessage?.attachments?.[0]?.name === 'briefing.txt', 'Attachment metadata was not persisted.');

  const history = await request(`/api/conversations/${conversation.body.id}`, { headers: { Cookie: cookie } });
  assert(history.response.status === 200 && history.body.messages?.length === 3, 'History persistence failed.');

  const otherLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'other@miar.local', token: 'smoke-token' }),
  });
  const otherCookie = otherLogin.response.headers.get('set-cookie')?.split(';', 1)[0];
  assert(otherLogin.response.status === 200 && otherCookie, 'Second user login failed.');
  const isolatedHistory = await request(`/api/conversations/${conversation.body.id}`, { headers: { Cookie: otherCookie } });
  assert(isolatedHistory.response.status === 404, `Conversation leaked across users: ${isolatedHistory.response.status}.`);
  const isolatedAttachment = await fetch(`${baseUrl}${upload.body.url}`, { headers: { Cookie: otherCookie } });
  assert(isolatedAttachment.status === 404, `Attachment leaked across users: ${isolatedAttachment.status}.`);
  console.log('API smoke test passed: auth, validation, isolation, story, conversation, upload, download, full-history flag, attachments, demo reply and history.');
} finally {
  if (server.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      server.kill('SIGTERM');
    }
  }
}

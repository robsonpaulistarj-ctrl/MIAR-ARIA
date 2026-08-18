import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const apiPort = Number(process.env.SMOKE_VISION_API_PORT ?? 18081);
const providerPort = Number(process.env.SMOKE_VISION_PROVIDER_PORT ?? 18082);
const uploadDir = `/tmp/miar-vision-smoke-${randomUUID()}`;
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
let providerRequest;

const provider = createServer(async (request, response) => {
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  providerRequest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ choices: [{ message: { content: 'A imagem foi recebida pelo modelo de visão.' } }] }));
});
await new Promise((resolve) => provider.listen(providerPort, '127.0.0.1', resolve));

const api = spawn('pnpm', ['--filter', './artifacts/api-server', 'dev'], {
  cwd: new URL('..', import.meta.url),
  detached: true,
  env: {
    ...process.env,
    PORT: String(apiPort),
    NODE_ENV: 'development',
    AI_MODE: 'live',
    OPENAI_API_KEY: 'vision-smoke-key',
    OPENAI_API_BASE: `http://127.0.0.1:${providerPort}/v1`,
    MIAR_ACCESS_TOKEN: 'vision-smoke-token',
    DATABASE_URL: '',
    UPLOAD_DIR: uploadDir,
  },
  stdio: 'ignore',
});
const baseUrl = `http://127.0.0.1:${apiPort}`;
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
  assert(health?.ok, 'Vision API did not become ready within 20 seconds.');

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'vision@miar.local', token: 'vision-smoke-token' }),
  });
  assert(login.response.status === 200, `Vision login failed: ${login.response.status}.`);
  const cookie = login.response.headers.get('set-cookie')?.split(';', 1)[0];
  assert(cookie, 'Vision login did not set a cookie.');

  const story = await request('/api/stories', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: 'Vision Smoke', description: 'Teste multimodal', color: '#3F8F4F' }),
  });
  const conversation = await request('/api/conversations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ storyId: story.body.id, title: 'Imagem' }),
  });
  const form = new FormData();
  form.append('file', new Blob([imageBytes], { type: 'image/png' }), 'pixel.png');
  const upload = await request('/api/uploads', { method: 'POST', headers: { Cookie: cookie }, body: form });
  assert(upload.response.status === 201, `Vision upload failed: ${upload.response.status}.`);

  const message = await request(`/api/conversations/${conversation.body.id}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ content: 'O que vê nesta imagem?', attachments: [upload.body] }),
  });
  assert(message.response.status === 201, `Vision message failed: ${message.response.status} ${JSON.stringify(message.body)}.`);
  const latest = providerRequest?.messages?.at(-1);
  assert(Array.isArray(latest?.content), 'Provider did not receive multipart content.');
  assert(latest.content.some((part) => part.type === 'image_url' && part.image_url?.url?.startsWith('data:image/png;base64,')), 'Provider did not receive the image data URL.');
  console.log('Vision smoke test passed: uploaded image was delivered to the OpenAI-compatible provider.');
} finally {
  if (api.pid) {
    try {
      process.kill(-api.pid, 'SIGTERM');
    } catch {
      api.kill('SIGTERM');
    }
  }
  provider.close();
  await rm(uploadDir, { recursive: true, force: true });
}

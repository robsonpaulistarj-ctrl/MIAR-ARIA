import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const maxAttachmentBytes = 25 * 1024 * 1024;
const storageProvider = (process.env.STORAGE_PROVIDER ?? 'local').trim().toLowerCase();
const allowEphemeralStorage = process.env.ALLOW_EPHEMERAL_STORAGE === 'true';
const uploadRoot = resolve(process.env.UPLOAD_DIR ?? join(process.cwd(), 'data', 'uploads'));
const bucket = process.env.STORAGE_BUCKET?.trim();
const region = process.env.STORAGE_REGION?.trim() || 'auto';
const endpoint = process.env.STORAGE_ENDPOINT?.trim();
const forcePathStyle = process.env.STORAGE_FORCE_PATH_STYLE === 'true';

if (process.env.NODE_ENV === 'production' && storageProvider !== 's3' && !(allowEphemeralStorage && storageProvider === 'local')) {
  throw new Error('STORAGE_PROVIDER=s3 is required in production unless ALLOW_EPHEMERAL_STORAGE=true is explicitly enabled for private staging.');
}
if (storageProvider === 's3' && (!bucket || !process.env.STORAGE_ACCESS_KEY_ID?.trim() || !process.env.STORAGE_SECRET_ACCESS_KEY?.trim())) {
  throw new Error('S3 storage requires STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY.');
}

const s3 = storageProvider === 's3'
  ? new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!.trim(),
    },
  })
  : null;

export type StoredAttachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  key: string;
  url: string;
};

function safeFileName(name: string) {
  const normalized = name.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.slice(0, 180) || 'attachment';
}

function encodeKey(key: string) {
  return Buffer.from(key, 'utf8').toString('base64url');
}

export function decodeKey(encodedKey: string) {
  return Buffer.from(encodedKey, 'base64url').toString('utf8');
}

function keyForUser(userId: string, key: string) {
  if (!key.startsWith(`${userId}/`)) throw new Error('Attachment does not belong to the current user.');
  if (key.includes('..') || key.includes('\\')) throw new Error('Invalid attachment key.');
  return key;
}

function localPathForKey(key: string) {
  const path = resolve(uploadRoot, key);
  const relativePath = relative(uploadRoot, path);
  if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) throw new Error('Invalid attachment path.');
  return path;
}

export async function storeAttachment(input: {
  userId: string;
  name: string;
  type: string;
  size: number;
  buffer: Buffer;
}) : Promise<StoredAttachment> {
  if (input.size <= 0 || input.size > maxAttachmentBytes) throw new Error('Attachment size is invalid.');
  if (input.buffer.length !== input.size) throw new Error('Attachment payload size does not match metadata.');

  const id = randomUUID();
  const key = `${input.userId}/${id}-${safeFileName(input.name)}`;
  const checksum = createHash('sha256').update(input.buffer).digest('hex');

  if (storageProvider === 's3') {
    await s3!.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.buffer,
      ContentType: input.type || 'application/octet-stream',
      ContentLength: input.size,
      Metadata: { userId: input.userId, checksum },
    }));
  } else {
    const path = localPathForKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.buffer, { flag: 'wx' });
    await writeFile(`${path}.meta.json`, JSON.stringify({ contentType: input.type || 'application/octet-stream', size: input.size }), { flag: 'wx' });
  }

  return {
    id,
    name: input.name,
    type: input.type || 'application/octet-stream',
    size: input.size,
    key,
    url: `/api/uploads/${encodeKey(key)}`,
  };
}

async function readAttachmentByKey(userId: string, key: string) {
  const safeKey = keyForUser(userId, key);
  if (storageProvider === 's3') {
    const object = await s3!.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey }));
    if (!object.Body) throw new Error('Attachment body is empty.');
    return {
      body: object.Body as NodeJS.ReadableStream,
      contentType: object.ContentType ?? 'application/octet-stream',
      contentLength: object.ContentLength,
    };
  }

  const path = localPathForKey(safeKey);
  const body = await readFile(path);
  let contentType = 'application/octet-stream';
  try {
    const metadata = JSON.parse(await readFile(`${path}.meta.json`, 'utf8')) as { contentType?: string };
    if (metadata.contentType) contentType = metadata.contentType;
  } catch {
    // Older local uploads may not have metadata; keep the safe binary fallback.
  }
  return { body, contentType, contentLength: body.length };
}

export async function readAttachment(userId: string, encodedKey: string) {
  return readAttachmentByKey(userId, decodeKey(encodedKey));
}

export async function readAttachmentBuffer(userId: string, key: string): Promise<{ body: Buffer; contentType: string; contentLength: number }> {
  const attachment = await readAttachmentByKey(userId, key);
  if (Buffer.isBuffer(attachment.body)) {
    return { body: attachment.body, contentType: attachment.contentType, contentLength: attachment.contentLength ?? attachment.body.length };
  }
  const chunks: Buffer[] = [];
  for await (const chunk of attachment.body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  return { body, contentType: attachment.contentType, contentLength: body.length };
}

export function getStorageConfig() {
  return {
    provider: storageProvider,
    bucket: bucket ?? null,
    maxAttachmentBytes,
  };
}

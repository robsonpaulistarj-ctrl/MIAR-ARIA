import { Router, type IRouter, type RequestHandler } from 'express';
import multer from 'multer';
import { ApiError, getCurrentUser } from '../lib/current-user';
import { readAttachment, storeAttachment } from '../lib/attachment-storage';
import { rateLimit } from '../lib/rate-limit';

const router: IRouter = Router();
const maxAttachmentBytes = 25 * 1024 * 1024;
const allowedMimeType = /^(image\/|audio\/|video\/)|^(application\/pdf|text\/plain)$/i;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAttachmentBytes, files: 1 },
  fileFilter: (_request, file, callback) => {
    if (!allowedMimeType.test(file.mimetype)) {
      callback(new ApiError(415, 'Unsupported attachment type.'));
      return;
    }
    callback(null, true);
  },
});

const uploadSingle: RequestHandler = (request, response, next) => {
  upload.single('file')(request, response, (error: unknown) => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      next(new ApiError(413, 'Attachment exceeds the 25 MB limit.'));
      return;
    }
    next(error instanceof ApiError ? error : new ApiError(400, 'Invalid multipart upload.'));
  });
};

router.post('/uploads', rateLimit({ name: 'upload', windowMs: 60_000, max: 30 }), uploadSingle, async (request, response) => {
  const user = await getCurrentUser(request);
  const file = request.file;
  if (!file) throw new ApiError(400, 'A file field is required.');

  const stored = await storeAttachment({
    userId: user.id,
    name: file.originalname,
    type: file.mimetype,
    size: file.size,
    buffer: file.buffer,
  });
  response.status(201).json(stored);
});

router.get('/uploads/:encodedKey', async (request, response) => {
  const user = await getCurrentUser(request);
  try {
    const attachment = await readAttachment(user.id, request.params.encodedKey);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Type', attachment.contentType);
    if (attachment.contentLength !== undefined) response.setHeader('Content-Length', String(attachment.contentLength));
    if (Buffer.isBuffer(attachment.body)) {
      response.send(attachment.body);
      return;
    }
    (attachment.body as NodeJS.ReadableStream & { pipe: (destination: NodeJS.WritableStream) => void }).pipe(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if ((error as NodeJS.ErrnoException).code === 'ENOENT'
      || (error as { name?: string }).name === 'NoSuchKey'
      || message.includes('does not belong')
      || message.includes('Invalid attachment key')) {
      throw new ApiError(404, 'Attachment not found.');
    }
    throw error;
  }
});

export default router;

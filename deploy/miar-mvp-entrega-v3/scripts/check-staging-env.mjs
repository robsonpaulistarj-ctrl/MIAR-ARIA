const isProduction = process.env.NODE_ENV === 'production';
const allowEphemeralDb = process.env.ALLOW_EPHEMERAL_DB === 'true';
const allowEphemeralStorage = process.env.ALLOW_EPHEMERAL_STORAGE === 'true';
const requiredInProduction = ['MIAR_ACCESS_TOKEN', 'WEB_ORIGIN', 'STORAGE_PROVIDER'];
const missing = requiredInProduction.filter((key) => !process.env[key]?.trim());
if (!allowEphemeralDb && !process.env.DATABASE_URL?.trim()) missing.push('DATABASE_URL');
if (!allowEphemeralStorage) {
  for (const key of ['STORAGE_BUCKET', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY']) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
}
const warnings = [];

if (!isProduction) {
  console.log('Staging preflight skipped: NODE_ENV is not production.');
  process.exit(0);
}

if (missing.length) {
  console.error(`Missing production environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

if (process.env.AI_MODE !== 'demo' && !process.env.OPENAI_API_KEY?.trim()) {
  console.error('OPENAI_API_KEY is required when AI_MODE is not demo.');
  process.exit(1);
}

if (process.env.STORAGE_PROVIDER !== 's3' && !(allowEphemeralStorage && process.env.STORAGE_PROVIDER === 'local')) {
  console.error('Production storage must use s3, or local storage with ALLOW_EPHEMERAL_STORAGE=true for private staging.');
  process.exit(1);
}

if (process.env.WEB_ORIGIN.split(',').some((origin) => origin.trim() === '*')) {
  console.error('WEB_ORIGIN cannot contain * when credentials are enabled.');
  process.exit(1);
}

if (process.env.AI_MODE === 'demo') {
  warnings.push('AI_MODE=demo: responses will be deterministic and will not use an external model.');
}
if (allowEphemeralDb) {
  warnings.push('ALLOW_EPHEMERAL_DB=true: stories and sessions are stored in memory and are lost on restart.');
}
if (allowEphemeralStorage) {
  warnings.push('ALLOW_EPHEMERAL_STORAGE=true: attachments use the local filesystem and may be lost on redeploy.');
}

console.log('Staging preflight passed.');
for (const warning of warnings) console.warn(`Warning: ${warning}`);

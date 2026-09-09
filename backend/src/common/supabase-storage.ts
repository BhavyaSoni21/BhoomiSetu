import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as path from 'path';
import * as fs from 'fs/promises';

// Object storage for every generated/uploaded image this app persists
// (historical-imagery snapshots, seeded parcel documents, citizen-submitted
// workflow evidence) - previously written unconditionally to backend/uploads/
// on local disk, which doesn't survive a redeploy/restart on a hosted
// environment with an ephemeral or per-instance filesystem.
//
// Same "unset config degrades gracefully, doesn't crash the surrounding
// request" shape as GroqService/Fast2SMS/SMTP, but inverted: those features
// are optional and 503 without a key. Image storage isn't optional - every
// environment needs *somewhere* to put these files - so the fallback is
// local disk (exactly the old, zero-config behavior) rather than a 503. This
// keeps `npm test`/local dev working with no setup at all, and lets a real
// hosted deployment opt into durable storage by setting SUPABASE_URL +
// SUPABASE_SECRET_KEY (see backend/.env.example) - the one config a
// deployment target with an ephemeral filesystem actually needs to add.
const LOCAL_FALLBACK_DIR = path.resolve(process.cwd(), 'uploads');

// One bucket, one prefix per upload kind (mirrors the old uploads/<kind>/
// folder layout) rather than three buckets - simpler to provision, and
// nothing here needs per-kind bucket policies since every read still goes
// through this app's own auth checks (see below), never a public bucket URL.
const BUCKET = 'bhoomisetu-uploads';

let client: SupabaseClient | null = null;

function isStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

function getClient(): SupabaseClient {
  if (client) return client;
  // The secret key (Supabase's current-generation key format, sb_secret_... -
  // the equivalent of the older service_role JWT key) must never reach the
  // frontend - it bypasses Row Level Security entirely. It's only ever read
  // from the backend's own process env here, same rule GROQ_API_KEY already
  // follows.
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

// Idempotent - safe to call on every backend/seed startup. A no-op when
// storage isn't configured (local-disk fallback needs no bucket). Bucket is
// private (public: false): nothing here is meant to be fetched by a bare
// URL, every read is proxied through this app's own controllers so the
// existing per-document/per-workflow access checks (citizen ownership,
// staff-only, etc.) keep applying exactly as they did when these were local
// files - object storage only replaces *where the bytes live*, not who's
// allowed to ask for them.
export async function ensureStorageBucketExists(): Promise<void> {
  if (!isStorageConfigured()) return;
  const supabase = getClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`Failed to list Supabase Storage buckets: ${listError.message}`);
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error: createError } = await supabase.storage.createBucket(BUCKET, { public: false });
  // A concurrent seed/startup racing to create the same bucket is fine to
  // ignore; any other failure (bad key, no permission) should surface.
  if (createError && !createError.message.toLowerCase().includes('already exists')) {
    throw new Error(`Failed to create Supabase Storage bucket '${BUCKET}': ${createError.message}`);
  }
}

// `key` is normally a relative object path, e.g.
// 'cluster-snapshots/pune-cluster-1-2026.png' - stored verbatim in the
// owning entity's filePath/imagePath column, same shape whether it resolves
// to a Supabase Storage object or a local file. In local-fallback mode an
// already-absolute path is read/written as-is instead of joined under
// LOCAL_FALLBACK_DIR - some test fixtures seed a row pointing straight at a
// real file elsewhere on disk (e.g. os.tmpdir()) without going through
// uploadToStorage first, which is a legitimate way to set up "this row
// already has a document" without needing the full upload flow.
function resolveLocalPath(key: string): string {
  return path.isAbsolute(key) ? key : path.join(LOCAL_FALLBACK_DIR, key);
}

export async function uploadToStorage(key: string, buffer: Buffer, contentType: string): Promise<void> {
  if (!isStorageConfigured()) {
    const localPath = resolveLocalPath(key);
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    await fs.writeFile(localPath, buffer);
    return;
  }
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, { contentType, upsert: true });
  if (error) throw new Error(`Failed to upload '${key}' to Supabase Storage: ${error.message}`);
}

export async function downloadFromStorage(key: string): Promise<Buffer> {
  if (!isStorageConfigured()) {
    return fs.readFile(resolveLocalPath(key));
  }
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(key);
  if (error) throw new Error(`Failed to download '${key}' from Supabase Storage: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

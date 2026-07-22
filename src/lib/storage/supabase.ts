import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/**
 * Server-side Supabase-client met de service-role key — nooit in de browser
 * gebruiken. Nodig voor toegang tot de (private) CV-bucket.
 */
function getServiceClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY moeten gezet zijn in de environment (.env).",
    );
  }

  client = createClient(url, serviceRoleKey);
  return client;
}

function getCvsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CVS;
  if (!bucket) {
    throw new Error("SUPABASE_STORAGE_BUCKET_CVS moet gezet zijn in de environment (.env).");
  }
  return bucket;
}

/** Maakt de bucket aan (private) als deze nog niet bestaat. */
export async function ensureCvsBucketExists(): Promise<void> {
  const supabase = getServiceClient();
  const bucket = getCvsBucketName();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Kon Supabase Storage buckets niet ophalen: ${listError.message}`);
  }

  if (buckets?.some((b) => b.name === bucket)) return;

  const { error: createError } = await supabase.storage.createBucket(bucket, { public: false });
  if (createError) {
    throw new Error(`Kon bucket "${bucket}" niet aanmaken: ${createError.message}`);
  }
}

/**
 * Uploadt het originele CV-bestand naar de (private) CV-bucket op pad
 * `{candidateId}/{origineel-bestandsnaam}`. Overschrijft een bestaand
 * bestand op hetzelfde pad (upsert) — nodig omdat hetzelfde CV nogmaals
 * uploaden de bestaande kandidaat bijwerkt op hetzelfde pad.
 */
export async function uploadCvFile(
  candidateId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const supabase = getServiceClient();
  const bucket = getCvsBucketName();
  const path = `${candidateId}/${fileName}`;

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload naar Supabase Storage mislukt voor "${path}": ${error.message}`);
  }

  return path;
}

// ---------------------------------------------------------------------------
// Generieke, bucket-parameteriseerbare helpers (fase 4: presentaties-bucket).
// Additief t.o.v. bovenstaande CV-specifieke functies — die blijven ongewijzigd.
// ---------------------------------------------------------------------------

/** Maakt een willekeurige bucket aan (private) als deze nog niet bestaat. */
export async function ensureBucketExists(bucketName: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    throw new Error(`Kon Supabase Storage buckets niet ophalen: ${listError.message}`);
  }

  if (buckets?.some((b) => b.name === bucketName)) return;

  const { error: createError } = await supabase.storage.createBucket(bucketName, { public: false });
  if (createError) {
    throw new Error(`Kon bucket "${bucketName}" niet aanmaken: ${createError.message}`);
  }
}

/** Downloadt een bestand uit een willekeurige (private) bucket. */
export async function downloadFile(bucket: string, path: string): Promise<Buffer> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    throw new Error(`Download uit Supabase Storage mislukt voor "${bucket}/${path}": ${error.message}`);
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/** Uploadt een bestand naar een willekeurige (private) bucket (upsert). */
export async function uploadFile(bucket: string, path: string, buffer: Buffer, mimeType: string): Promise<string> {
  const supabase = getServiceClient();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Upload naar Supabase Storage mislukt voor "${bucket}/${path}": ${error.message}`);
  }
  return path;
}

// ---------------------------------------------------------------------------
// Signed URLs (fase 6 — dashboard): buckets blijven privé, de UI krijgt
// alleen kortlevende, server-side gegenereerde download-links te zien.
// ---------------------------------------------------------------------------

/** Genereert een kortlevende signed URL voor een bestand in een private bucket. */
export async function createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) {
    throw new Error(`Kon geen signed URL genereren voor "${bucket}/${path}": ${error?.message ?? "onbekende fout"}`);
  }
  return data.signedUrl;
}

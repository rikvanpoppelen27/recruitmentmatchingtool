import { NextResponse } from "next/server";

import { restoreFrontsheetRevision } from "@/lib/pdf/refineFrontsheet";
import { createSignedUrl } from "@/lib/storage/supabase";

const SIGNED_URL_TTL_SECONDS = 300;

function getPresentationsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRESENTATIONS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_PRESENTATIONS moet gezet zijn in de environment (.env).");
  return bucket;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; revisionId: string }> },
) {
  const { id, revisionId } = await params;

  try {
    const result = await restoreFrontsheetRevision(id, revisionId);
    const signedUrl = await createSignedUrl(getPresentationsBucketName(), result.storagePath, SIGNED_URL_TTL_SECONDS);
    return NextResponse.json({ ...result, signedUrl });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { refineFrontsheetForMatch } from "@/lib/pdf/refineFrontsheet";
import { createSignedUrl } from "@/lib/storage/supabase";

const SIGNED_URL_TTL_SECONDS = 300;

function getPresentationsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRESENTATIONS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_PRESENTATIONS moet gezet zijn in de environment (.env).");
  return bucket;
}

const bodySchema = z.object({
  instruction: z.string().min(1, "Geef een instructie op."),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  try {
    const result = await refineFrontsheetForMatch(id, parsed.data.instruction);
    const signedUrl = await createSignedUrl(getPresentationsBucketName(), result.storagePath, SIGNED_URL_TTL_SECONDS);
    return NextResponse.json({ ...result, signedUrl });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

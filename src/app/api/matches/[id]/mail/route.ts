import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateMailDraftForMatch, getStyleProfileWithExamples } from "@/lib/mail/generateMailDraft";

const bodySchema = z.object({
  variant: z.enum(["standaard", "korter", "formeler", "informeler"]).default("standaard"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const styleProfile = await getStyleProfileWithExamples();
  if (!styleProfile) {
    return NextResponse.json(
      { error: 'Nog geen stijlprofiel gevonden. Bouw er eerst één via /instellingen.' },
      { status: 400 },
    );
  }

  try {
    const draft = await generateMailDraftForMatch(id, parsed.data.variant, styleProfile);
    return NextResponse.json(draft);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

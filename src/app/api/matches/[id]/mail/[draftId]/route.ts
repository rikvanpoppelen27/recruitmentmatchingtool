import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

const patchSchema = z.object({
  subject: z.string().min(1, "Onderwerp mag niet leeg zijn."),
  body: z.string().min(1, "Body mag niet leeg zijn."),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; draftId: string }> }) {
  const { id, draftId } = await params;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const existing = await prisma.emailDraft.findUnique({ where: { id: draftId } });
  if (!existing || existing.matchId !== id) {
    return NextResponse.json({ error: "Mailconcept niet gevonden voor deze match." }, { status: 404 });
  }

  const draft = await prisma.emailDraft.update({
    where: { id: draftId },
    data: { subject: parsed.data.subject, body: parsed.data.body },
  });

  return NextResponse.json({ draft });
}

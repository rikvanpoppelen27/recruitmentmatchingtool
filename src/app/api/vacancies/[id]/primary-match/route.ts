import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";

const bodySchema = z.object({
  matchId: z.string().min(1),
});

/** Handmatig wisselen van de primaire kandidaat voor een vacature (fase 6B, als meerdere kandidaten boven de drempel zitten). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: parsed.data.matchId } });
  if (!match || match.vacancyId !== id) {
    return NextResponse.json({ error: "Match niet gevonden voor deze vacature." }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.match.updateMany({ where: { vacancyId: id, id: { not: match.id } }, data: { isPrimary: false } }),
    prisma.match.update({ where: { id: match.id }, data: { isPrimary: true } }),
  ]);

  return NextResponse.json({ success: true });
}

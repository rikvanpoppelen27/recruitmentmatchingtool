import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { mailTemplateUpdateSchema } from "@/lib/validation/mail-template";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = mailTemplateUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  try {
    const template = await prisma.$transaction(async (tx) => {
      if (parsed.data.isDefault) {
        await tx.mailTemplate.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      }
      return tx.mailTemplate.update({ where: { id }, data: parsed.data });
    });
    return NextResponse.json({ template });
  } catch {
    return NextResponse.json({ error: `Mailtemplate "${id}" niet gevonden.` }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.mailTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: `Mailtemplate "${id}" niet gevonden.` }, { status: 404 });
  }
}

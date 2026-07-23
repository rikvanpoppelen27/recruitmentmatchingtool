import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { mailTemplateInputSchema } from "@/lib/validation/mail-template";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = mailTemplateInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const { isDefault, ...data } = parsed.data;

  const template = await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.mailTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    }
    return tx.mailTemplate.create({ data: { ...data, isDefault } });
  });

  return NextResponse.json({ template });
}

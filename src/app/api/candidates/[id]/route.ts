import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizePhone } from "@/lib/cv/normalizePhone";
import { prisma } from "@/lib/db/prisma";

const emptyToNull = (value: unknown) => (value === "" ? null : value);

const patchSchema = z.object({
  email: z.preprocess(emptyToNull, z.string().email("Ongeldig e-mailadres.").nullable()).optional(),
  phone: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const data: { email?: string | null; phone?: string | null; phoneRaw?: string | null } = {};
  if (parsed.data.email !== undefined) {
    data.email = parsed.data.email;
  }
  if (parsed.data.phone !== undefined) {
    const normalized = normalizePhone(parsed.data.phone);
    data.phone = normalized.phone;
    data.phoneRaw = normalized.phoneRaw;
  }

  try {
    const candidate = await prisma.candidate.update({ where: { id }, data });
    return NextResponse.json({ candidate });
  } catch {
    return NextResponse.json({ error: `Kandidaat "${id}" niet gevonden.` }, { status: 404 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { searchProfileUpdateSchema } from "@/lib/validation/search-profile";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const json = await request.json().catch(() => null);
  const parsed = searchProfileUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  try {
    const profile = await prisma.searchProfile.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: `Zoekprofiel "${id}" niet gevonden.` }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.searchProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: `Zoekprofiel "${id}" niet gevonden.` }, { status: 404 });
  }
}

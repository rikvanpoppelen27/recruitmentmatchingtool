import { NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { enqueueShortlistAutomation } from "@/lib/vacancy/shortlistAutomation";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.vacancy.update({
      where: { id },
      data: { isShortlisted: true, shortlistedAt: new Date() },
    });
  } catch {
    return NextResponse.json({ error: `Vacature "${id}" niet gevonden.` }, { status: 404 });
  }

  try {
    const result = await enqueueShortlistAutomation(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    await prisma.vacancy.update({
      where: { id },
      data: { isShortlisted: false, shortlistedAt: null },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: `Vacature "${id}" niet gevonden.` }, { status: 404 });
  }
}

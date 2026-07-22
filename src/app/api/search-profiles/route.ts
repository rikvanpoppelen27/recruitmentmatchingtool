import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { searchProfileInputSchema } from "@/lib/validation/search-profile";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = searchProfileInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const profile = await prisma.searchProfile.create({ data: parsed.data });
  return NextResponse.json({ profile });
}

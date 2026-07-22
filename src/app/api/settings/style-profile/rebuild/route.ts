import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { rebuildStyleProfile } from "@/lib/mail/buildStyleProfile";

const bodySchema = z.object({
  maskContactInfo: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  try {
    const result = await rebuildStyleProfile({ maskContactInfo: parsed.data.maskContactInfo });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

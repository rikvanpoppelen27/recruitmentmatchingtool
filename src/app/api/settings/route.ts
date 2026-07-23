import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { updateAppSettings } from "@/lib/settings";

const patchSchema = z.object({
  matchThreshold: z.number().int().min(0).max(100).optional(),
  skillWeight: z.number().min(0).max(1).optional(),
  semanticWeight: z.number().min(0).max(1).optional(),
  mustHaveWeight: z.number().min(0).max(1).optional(),
  niceToHaveWeight: z.number().min(0).max(1).optional(),
  knockOutCapScore: z.number().int().min(0).max(100).optional(),
  aiCallMustHaveThreshold: z.number().min(0).max(1).optional(),
  anonymizeCV: z.boolean().optional(),
  companyName: z.string().min(1).optional(),
  footerText: z.string().min(1).optional(),
  autoGenerateMode: z.enum(["volledig", "alleen_matchen"]).optional(),
});

export async function PATCH(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  const settings = await updateAppSettings(parsed.data);
  return NextResponse.json({ settings });
}

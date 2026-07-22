import { NextRequest, NextResponse } from "next/server";

import { createManualVacancy } from "@/lib/vacancy/createManualVacancy";
import { manualVacancyInputSchema } from "@/lib/validation/vacancy";

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parsed = manualVacancyInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  }

  try {
    const result = await createManualVacancy(parsed.data, { force: parsed.data.force });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

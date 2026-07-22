import { NextResponse } from "next/server";

import { runSearchProfileNow } from "@/lib/import/runImport";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const summary = await runSearchProfileNow(id);
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

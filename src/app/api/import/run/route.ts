import { NextResponse } from "next/server";

import { runImport } from "@/lib/import/runImport";

export async function POST() {
  try {
    const summary = await runImport();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

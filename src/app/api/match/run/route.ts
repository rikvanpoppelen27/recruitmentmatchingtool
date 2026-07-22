import { NextResponse } from "next/server";

import { runMatching } from "@/lib/match/runMatching";

export async function POST() {
  try {
    const summary = await runMatching();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

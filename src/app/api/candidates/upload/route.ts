import { NextRequest, NextResponse } from "next/server";

import { processCvUpload } from "@/lib/cv/processCvUpload";
import { prisma } from "@/lib/db/prisma";
import { ensureCvsBucketExists } from "@/lib/storage/supabase";

interface UploadFileResult {
  fileName: string;
  success: boolean;
  error?: string;
  candidateId?: string;
  fullName?: string | null;
  outcome?: "new" | "updated";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Geen bestanden ontvangen. Sleep één of meer PDF/DOCX-bestanden hierheen." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  if (!user) {
    return NextResponse.json({ error: "Geen gebruiker gevonden. Draai `npm run db:seed`." }, { status: 500 });
  }

  await ensureCvsBucketExists();

  const results: UploadFileResult[] = [];

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await processCvUpload(buffer, file.name, user.id);
      results.push({
        fileName: file.name,
        success: true,
        candidateId: result.candidateId,
        fullName: result.fullName,
        outcome: result.outcome,
      });
    } catch (error) {
      results.push({ fileName: file.name, success: false, error: (error as Error).message });
    }
  }

  return NextResponse.json({ results });
}

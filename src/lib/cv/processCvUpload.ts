import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { parseCv, type ParsedCandidate } from "../ai/parse-cv";
import { prisma } from "../db/prisma";
import { uploadCvFile } from "../storage/supabase";
import { extractCvText, getMimeType } from "./extract";

export interface ProcessCvResult {
  fileName: string;
  outcome: "new" | "updated";
  candidateId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  phoneRaw: string | null;
  skillCount: number;
  yearsExperience: number | null;
}

/**
 * Verwerkt één CV-bestand end-to-end: tekst extraheren, parsen via Claude,
 * uploaden naar Supabase Storage, opslaan/bijwerken van het kandidaatrecord
 * (hash-dedupe op het bestand). Gedeelde implementatie voor
 * scripts/parse-cv.ts (CLI) en de upload-component op /kandidaten (route
 * handler POST /api/candidates/upload) — zo geven CLI en interface
 * gegarandeerd hetzelfde resultaat. Gooit een fout bij extractie- of
 * parse-mislukking; de aanroeper beslist hoe dat per bestand getoond wordt.
 */
export async function processCvUpload(buffer: Buffer, fileName: string, userId: string): Promise<ProcessCvResult> {
  const hash = createHash("sha256").update(buffer).digest("hex");

  const extracted = await extractCvText(buffer, fileName);
  const parsed: ParsedCandidate = await parseCv(extracted.text);

  const mimeType = getMimeType(extracted.fileType);
  const existing = await prisma.candidate.findUnique({ where: { cvFileHash: hash } });

  const candidateData = {
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone,
    phoneRaw: parsed.phoneRaw,
    region: parsed.region,
    yearsExperience: parsed.yearsExperience,
    skills: parsed.skills,
    languages: parsed.languages,
    availability: parsed.availability,
    cvFileName: fileName,
    cvMimeType: mimeType,
    parsedAt: new Date(),
    rawParsedData: parsed.raw as unknown as Prisma.InputJsonValue,
  };

  let candidateId: string;
  let outcome: "new" | "updated";

  if (existing) {
    await prisma.candidate.update({
      where: { id: existing.id },
      data: {
        ...candidateData,
        educations: { deleteMany: {}, create: parsed.educations },
        workExperience: { deleteMany: {}, create: parsed.workExperience },
      },
    });
    candidateId = existing.id;
    outcome = "updated";
  } else {
    const created = await prisma.candidate.create({
      data: {
        ...candidateData,
        userId,
        cvFileUrl: "",
        cvFileHash: hash,
        educations: { create: parsed.educations },
        workExperience: { create: parsed.workExperience },
      },
    });
    candidateId = created.id;
    outcome = "new";
  }

  const storagePath = await uploadCvFile(candidateId, fileName, buffer, mimeType);
  await prisma.candidate.update({ where: { id: candidateId }, data: { cvFileUrl: storagePath } });

  return {
    fileName,
    outcome,
    candidateId,
    fullName: parsed.fullName,
    email: parsed.email,
    phone: parsed.phone,
    phoneRaw: parsed.phoneRaw,
    skillCount: parsed.skills.length,
    yearsExperience: parsed.yearsExperience,
  };
}

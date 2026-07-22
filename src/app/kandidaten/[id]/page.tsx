import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { createSignedUrl } from "@/lib/storage/supabase";

import { ContactEditForm } from "../contact-edit-form";

const SIGNED_URL_TTL_SECONDS = 300;

function getCvsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_CVS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_CVS moet gezet zijn in de environment (.env).");
  return bucket;
}

interface CandidateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: CandidateDetailPageProps) {
  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: { educations: true, workExperience: true },
  });

  if (!candidate) notFound();

  const cvSignedUrl = candidate.cvFileUrl
    ? await createSignedUrl(getCvsBucketName(), candidate.cvFileUrl, SIGNED_URL_TTL_SECONDS)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/kandidaten" className="text-sm text-neutral-500 hover:underline">
          ← Terug naar kandidaten
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-900">{candidate.fullName ?? "Naam onbekend"}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {candidate.region ?? "Regio onbekend"} —{" "}
            {candidate.yearsExperience !== null ? `${candidate.yearsExperience} jaar ervaring` : "Ervaring onbekend"}
          </p>
        </div>
        {cvSignedUrl && (
          <a
            href={cvSignedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Origineel CV openen
          </a>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contactgegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactEditForm candidateId={candidate.id} email={candidate.email} phone={candidate.phone} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {candidate.skills.length === 0 && <span className="text-sm text-neutral-400">Geen skills geparst.</span>}
          {candidate.skills.map((skill) => (
            <Badge key={skill}>{skill}</Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Werkervaring</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {candidate.workExperience.length === 0 && <p className="text-neutral-400">Geen werkervaring geparst.</p>}
          {candidate.workExperience.map((w) => (
            <div key={w.id} className="border-b border-neutral-100 pb-2 last:border-none last:pb-0">
              <p className="font-medium text-neutral-900">
                {w.jobTitle ?? "Functie onbekend"} {w.employer ? `— ${w.employer}` : ""}
              </p>
              <p className="text-xs text-neutral-500">{w.period ?? "Periode onbekend"}</p>
              {w.description && <p className="mt-1 text-neutral-700">{w.description}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Opleiding</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {candidate.educations.length === 0 && <p className="text-neutral-400">Geen opleiding geparst.</p>}
            {candidate.educations.map((e) => (
              <p key={e.id}>
                {[e.degree, e.fieldOfStudy, e.institution].filter(Boolean).join(", ") || "Onbekend"}
                {e.startYear || e.endYear ? ` (${e.startYear ?? "?"}–${e.endYear ?? "?"})` : ""}
              </p>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Overig</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-neutral-700">
            <p>Talen: {candidate.languages.length > 0 ? candidate.languages.join(", ") : "Niet vermeld"}</p>
            <p>Beschikbaarheid: {candidate.availability ?? "Niet vermeld"}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

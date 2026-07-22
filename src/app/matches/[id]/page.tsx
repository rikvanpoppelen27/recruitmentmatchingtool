import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { matchSkills } from "@/lib/match/skills";
import { createSignedUrl } from "@/lib/storage/supabase";

import { FrontsheetPanel } from "./frontsheet-panel";
import { MailPanel } from "./mail-panel";

const SIGNED_URL_TTL_SECONDS = 300;

function getPresentationsBucketName(): string {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET_PRESENTATIONS;
  if (!bucket) throw new Error("SUPABASE_STORAGE_BUCKET_PRESENTATIONS moet gezet zijn in de environment (.env).");
  return bucket;
}

interface MatchDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function MatchDetailPage({ params }: MatchDetailPageProps) {
  const { id } = await params;

  const match = await prisma.match.findUnique({
    where: { id },
    include: {
      candidate: true,
      vacancy: true,
      frontsheet: true,
      emailDrafts: { orderBy: { generatedAt: "desc" } },
    },
  });

  if (!match) notFound();

  const { candidate, vacancy } = match;

  const skillBreakdown = matchSkills(candidate.skills, vacancy.mustHaveSkills, vacancy.niceToHaveSkills);

  const [styleProfile, initialSignedUrl] = await Promise.all([
    prisma.styleProfile.findFirst({ select: { id: true } }),
    match.frontsheet?.presentationPdfUrl
      ? createSignedUrl(getPresentationsBucketName(), match.frontsheet.presentationPdfUrl, SIGNED_URL_TTL_SECONDS)
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/matches" className="text-sm text-neutral-500 hover:underline">
          ← Terug naar matches
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Kandidaat</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-base font-semibold text-neutral-900">{candidate.fullName ?? "Naam onbekend"}</p>
            <p className="text-neutral-600">{candidate.region ?? "Regio onbekend"}</p>
            <p className="text-neutral-600">
              {candidate.yearsExperience !== null ? `${candidate.yearsExperience} jaar ervaring` : "Ervaring onbekend"}
            </p>
            <p className="text-neutral-600">{candidate.skills.length} skills</p>
            <Link href={`/kandidaten/${candidate.id}`} className="text-neutral-700 underline">
              Naar kandidaatprofiel
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vacature</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-base font-semibold text-neutral-900">{vacancy.title}</p>
            <p className="text-neutral-600">
              {vacancy.companyName} — {vacancy.location} ({vacancy.region})
            </p>
            <p className="text-neutral-600">{vacancy.seniority ?? "Senioriteit onbekend"}</p>
            <a href={vacancy.url} target="_blank" rel="noopener noreferrer" className="text-neutral-700 underline">
              Bron bekijken
            </a>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Eindscore</p>
              <p className="text-4xl font-bold text-neutral-900">{match.score}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Skill-score</p>
              <p className="text-xl font-semibold text-neutral-700">{match.skillScore}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Semantische score</p>
              <p className="text-xl font-semibold text-neutral-700">{match.semanticScore ?? "n.v.t."}</p>
            </div>
          </div>
          {match.isPromising ? <Badge variant="success">Kansrijk</Badge> : <Badge variant="neutral">Niet kansrijk</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Onderbouwing</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <p className="whitespace-pre-line text-neutral-700">{match.rationale}</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Gematchte skills</p>
              <div className="flex flex-wrap gap-1">
                {match.matchedSkills.length === 0 && <span className="text-neutral-400">Geen</span>}
                {match.matchedSkills.map((skill) => (
                  <Badge key={skill} variant="success">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Ontbrekende must-haves
              </p>
              <div className="flex flex-wrap gap-1">
                {skillBreakdown.missingMustHaves.length === 0 && <span className="text-neutral-400">Geen</span>}
                {skillBreakdown.missingMustHaves.map((skill) => (
                  <Badge key={skill} variant="danger">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Ontbrekende nice-to-haves
              </p>
              <div className="flex flex-wrap gap-1">
                {skillBreakdown.missingNiceToHaves.length === 0 && <span className="text-neutral-400">Geen</span>}
                {skillBreakdown.missingNiceToHaves.map((skill) => (
                  <Badge key={skill} variant="warning">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Frontsheet</CardTitle>
        </CardHeader>
        <CardContent>
          <FrontsheetPanel
            matchId={match.id}
            initialSignedUrl={initialSignedUrl}
            initialGeneratedAt={match.frontsheet?.generatedAt ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mail</CardTitle>
        </CardHeader>
        <CardContent>
          <MailPanel
            matchId={match.id}
            hasStyleProfile={styleProfile !== null}
            initialDrafts={match.emailDrafts.map((d) => ({
              id: d.id,
              variant: d.variant.toLowerCase() as "standaard" | "korter" | "formeler" | "informeler",
              subject: d.subject,
              body: d.body,
              generatedAt: d.generatedAt,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
